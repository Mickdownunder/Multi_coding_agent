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

    // Pricing (per 1K tokens)
    let inputPrice = 0.03
    let outputPrice = 0.06

    if (model.includes('gpt-3.5') || model.includes('gpt-4o-mini') || model.includes('gemini-pro')) {
      inputPrice = 0.0015
      outputPrice = 0.002
    } else if (model.includes('gpt-4')) {
      inputPrice = 0.03
      outputPrice = 0.06
    }

    // Estimate: 70% input, 30% output
    const inputTokens = tokens * 0.7
    const outputTokens = tokens * 0.3

    return (inputTokens / 1000) * inputPrice + (outputTokens / 1000) * outputPrice
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
