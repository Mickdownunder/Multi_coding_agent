import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { ConfigService } from './config-service'

const CONTROL_DIR = join(process.cwd(), 'control')
const BUDGET_FILE = join(CONTROL_DIR, 'token-budget.json')

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public tokensUsed: number,
    public maxTokens: number
  ) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export interface TokenEstimate {
  estimatedTokens: number
  estimatedCost: number
  breakdown: {
    plan: number
    code: number
    chat: number
  }
}

export interface CostEstimate {
  totalCost: number
  tokensUsed: number
  tokensRemaining: number
  costBreakdown: {
    plan: number
    code: number
    chat: number
  }
}

interface BudgetState {
  tokensUsed: number
  tokensByCategory: {
    plan: number
    code: number
    chat: number
  }
  costByCategory: {
    plan: number
    code: number
    chat: number
  }
  lastUpdated: string
}

export class TokenBudgetService {
  private configService: ConfigService
  private budgetState: BudgetState | null = null
  private configLoaded = false

  constructor() {
    this.configService = new ConfigService()
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (!this.configLoaded) {
      await this.configService.loadConfig()
      this.configLoaded = true
    }
  }

  async loadBudgetState(forceReload = false): Promise<BudgetState> {
    if (this.budgetState && !forceReload) {
      return this.budgetState
    }

    try {
      const content = await readFile(BUDGET_FILE, 'utf-8')
      this.budgetState = JSON.parse(content) as BudgetState
      return this.budgetState
    } catch (error) {
      // File doesn't exist, create new budget state
      this.budgetState = {
        tokensUsed: 0,
        tokensByCategory: {
          plan: 0,
          code: 0,
          chat: 0
        },
        costByCategory: {
          plan: 0,
          code: 0,
          chat: 0
        },
        lastUpdated: new Date().toISOString()
      }
      await this.saveBudgetState()
      return this.budgetState
    }
  }

  private async saveBudgetState(): Promise<void> {
    if (!this.budgetState) {
      return
    }

    this.budgetState.lastUpdated = new Date().toISOString()
    await writeFile(BUDGET_FILE, JSON.stringify(this.budgetState, null, 2), 'utf-8')
  }

  async estimateProject(plan: { phases: Array<{ steps: unknown[] }> }): Promise<TokenEstimate> {
    await this.ensureConfigLoaded()
    const config = this.configService.getTokenBudgetConfig()
    
    // Rough estimation: 2000 tokens per step for code generation
    // 5000 tokens for plan generation
    // 1000 tokens per chat message
    const totalSteps = plan.phases.reduce((sum, phase) => sum + phase.steps.length, 0)
    
    const planTokens = 5000
    const codeTokens = totalSteps * 2000
    const chatTokens = 0 // User-controlled
    
    const estimatedTokens = planTokens + codeTokens + chatTokens
    
    // Cost estimation using Gemini 3 Flash pricing: $0.50/1M input, $3.00/1M output
    // Rough estimate: 70% input, 30% output
    const planCost = (planTokens * 0.7 / 1_000_000) * 0.50 + (planTokens * 0.3 / 1_000_000) * 3.00
    const codeCost = (codeTokens * 0.7 / 1_000_000) * 0.50 + (codeTokens * 0.3 / 1_000_000) * 3.00
    
    return {
      estimatedTokens,
      estimatedCost: planCost + codeCost,
      breakdown: {
        plan: planTokens,
        code: codeTokens,
        chat: chatTokens
      }
    }
  }

  async trackUsage(tokens: number, category: 'plan' | 'code' | 'chat' = 'code'): Promise<void> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    
    state.tokensUsed += tokens
    state.tokensByCategory[category] += tokens
    
    // Calculate cost using Gemini 3 Flash pricing
    const config = this.configService.getLLMConfig()
    const model = config.model[category] || config.model.code
    
    // Gemini 3 Flash pricing: $0.50 per 1M input, $3.00 per 1M output
    let inputPricePer1M = 0.50
    let outputPricePer1M = 3.00
    
    // Fallback for other models (legacy pricing)
    if (model.includes('gpt-4') && !model.includes('gemini')) {
      inputPricePer1M = 30.00  // $0.03 per 1K = $30 per 1M
      outputPricePer1M = 60.00  // $0.06 per 1K = $60 per 1M
    } else if ((model.includes('gpt-3.5') || model.includes('gpt-4o-mini')) && !model.includes('gemini')) {
      inputPricePer1M = 1.50  // $0.0015 per 1K = $1.50 per 1M
      outputPricePer1M = 2.00  // $0.002 per 1K = $2.00 per 1M
    }
    
    // Calculate cost: 70% input, 30% output
    const inputTokens = tokens * 0.7
    const outputTokens = tokens * 0.3
    const cost = (inputTokens / 1_000_000) * inputPricePer1M + (outputTokens / 1_000_000) * outputPricePer1M
    
    state.costByCategory[category] += cost
    
    this.budgetState = state
    await this.saveBudgetState()
  }

  async checkBudget(): Promise<boolean> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    const config = this.configService.getTokenBudgetConfig()
    
    return state.tokensUsed < config.maxPerProject
  }

  /**
   * HARD ENFORCEMENT: Enforce budget by throwing exception if exceeded
   * This ensures LLM calls cannot proceed if budget is exceeded
   */
  async enforceBudget(): Promise<void> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    const config = this.configService.getTokenBudgetConfig()
    
    if (state.tokensUsed >= config.maxPerProject) {
      throw new BudgetExceededError(
        `Token budget exceeded: ${state.tokensUsed} / ${config.maxPerProject} tokens used`,
        state.tokensUsed,
        config.maxPerProject
      )
    }
  }

  async getRemainingBudget(): Promise<number> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    const config = this.configService.getTokenBudgetConfig()
    
    return Math.max(0, config.maxPerProject - state.tokensUsed)
  }

  async getCostEstimate(forceReload = false): Promise<CostEstimate> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState(forceReload)
    const config = this.configService.getTokenBudgetConfig()
    
    return {
      totalCost: Object.values(state.costByCategory).reduce((sum, cost) => sum + cost, 0),
      tokensUsed: state.tokensUsed,
      tokensRemaining: config.maxPerProject - state.tokensUsed,
      costBreakdown: { ...state.costByCategory }
    }
  }

  async resetBudget(): Promise<void> {
    this.budgetState = {
      tokensUsed: 0,
      tokensByCategory: {
        plan: 0,
        code: 0,
        chat: 0
      },
      costByCategory: {
        plan: 0,
        code: 0,
        chat: 0
      },
      lastUpdated: new Date().toISOString()
    }
    await this.saveBudgetState()
    // Cache is already updated with reset values, so no need to clear
  }

  async isWarningThreshold(): Promise<boolean> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    const config = this.configService.getTokenBudgetConfig()
    
    const usageRatio = state.tokensUsed / config.maxPerProject
    return usageRatio >= config.warningThreshold
  }
}
