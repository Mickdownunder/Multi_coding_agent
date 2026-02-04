import { ConfigService } from './config-service'

export type TaskType = 'plan' | 'code' | 'chat' | 'verify'
export type TaskComplexity = 'simple' | 'medium' | 'complex'

export interface Task {
  type: TaskType
  complexity: TaskComplexity
  description: string
  estimatedTokens?: number
}

export class ModelSelector {
  private configService: ConfigService

  constructor() {
    this.configService = new ConfigService()
  }

  async selectModel(task: Task): Promise<string> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    const config = this.configService.getLLMConfig()

    // Plan generation always uses GPT-4 (needs quality)
    if (task.type === 'plan') {
      return config.model.plan
    }

    // Chat uses GPT-4 (needs quality)
    if (task.type === 'chat') {
      return config.model.chat
    }

    // Code generation: use GPT-3.5 for simple/medium, GPT-4 for complex
    if (task.type === 'code') {
      if (task.complexity === 'complex') {
        // For complex code, might want GPT-4, but default to 3.5 for cost
        return config.model.code
      }
      return config.model.code // Always use cheaper model for code
    }

    // Verify doesn't use LLM (local validation)
    if (task.type === 'verify') {
      throw new Error('Verification should not use LLM')
    }

    // Default to code model (cheapest)
    return config.model.code
  }

  async estimateCost(task: Task, tokens: number): Promise<number> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    const config = this.configService.getLLMConfig()
    
    // Get model based on task type
    let model: string
    if (task.type === 'plan') {
      model = config.model.plan
    } else if (task.type === 'chat') {
      model = config.model.chat
    } else {
      model = config.model.code
    }

    // Pricing (per 1M tokens) - Updated for Gemini 3 Flash
    let inputPricePer1M = 0.50  // $0.50 per 1M input tokens
    let outputPricePer1M = 3.00  // $3.00 per 1M output tokens

    if (model.includes('gemini-3-flash') || model.includes('gemini-3')) {
      // Gemini 3 Flash pricing: $0.50/1M input, $3.00/1M output
      inputPricePer1M = 0.50
      outputPricePer1M = 3.00
    } else if (model.includes('gpt-3.5') || model.includes('gpt-4o-mini') || model.includes('gemini-pro')) {
      // Legacy pricing for other models (per 1K tokens, converted to per 1M)
      inputPricePer1M = 1.50  // $0.0015 per 1K = $1.50 per 1M
      outputPricePer1M = 2.00  // $0.002 per 1K = $2.00 per 1M
    } else if (model.includes('gpt-4')) {
      // GPT-4 pricing (per 1K tokens, converted to per 1M)
      inputPricePer1M = 30.00  // $0.03 per 1K = $30.00 per 1M
      outputPricePer1M = 60.00  // $0.06 per 1K = $60.00 per 1M
    }

    // Estimate: 70% input, 30% output
    const inputTokens = tokens * 0.7
    const outputTokens = tokens * 0.3

    // Calculate cost (tokens in millions)
    const inputCost = (inputTokens / 1_000_000) * inputPricePer1M
    const outputCost = (outputTokens / 1_000_000) * outputPricePer1M

    return inputCost + outputCost
  }

  shouldUseFallback(task: Task, budgetRemaining: number, estimatedCost: number): boolean {
    // If budget is low and task is simple, use cheaper model
    if (budgetRemaining < 10000 && task.complexity === 'simple' && task.type === 'code') {
      return true
    }

    // If estimated cost exceeds remaining budget significantly
    if (estimatedCost > budgetRemaining * 0.5) {
      return true
    }

    return false
  }

  async getFallbackModel(task: Task): Promise<string> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    const config = this.configService.getLLMConfig()

    // Fallback to cheapest model
    if (task.type === 'code') {
      return 'gpt-3.5-turbo' // Cheapest option
    }

    // For plan/chat, can't really fallback (need quality)
    if (task.type === 'plan') {
      return config.model.plan
    }
    if (task.type === 'chat') {
      return config.model.chat
    }
    
    // Default to code model
    return config.model.code
  }
}
