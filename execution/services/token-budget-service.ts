import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { ConfigService } from './config-service'

const CONTROL_DIR = join(process.cwd(), 'control')
const BUDGET_FILE = join(CONTROL_DIR, 'token-budget.json')

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
    
    // Cost estimation (GPT-4: $0.03/1K input, $0.06/1K output)
    // GPT-3.5: $0.0015/1K input, $0.002/1K output
    // Rough estimate: 70% input, 30% output
    const planCost = (planTokens * 0.7 * 0.03 + planTokens * 0.3 * 0.06) / 1000
    const codeCost = (codeTokens * 0.7 * 0.0015 + codeTokens * 0.3 * 0.002) / 1000
    
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
    
    // Calculate cost
    const config = this.configService.getLLMConfig()
    let costPerToken = 0
    
    if (category === 'plan' || category === 'chat') {
      // GPT-4 pricing
      costPerToken = (0.03 / 1000) * 0.7 + (0.06 / 1000) * 0.3 // 70% input, 30% output
    } else {
      // GPT-3.5 pricing
      costPerToken = (0.0015 / 1000) * 0.7 + (0.002 / 1000) * 0.3
    }
    
    state.costByCategory[category] += tokens * costPerToken
    
    this.budgetState = state
    await this.saveBudgetState()
  }

  async checkBudget(): Promise<boolean> {
    await this.ensureConfigLoaded()
    const state = await this.loadBudgetState()
    const config = this.configService.getTokenBudgetConfig()
    
    return state.tokensUsed < config.maxPerProject
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
