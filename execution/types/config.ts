export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'gemini'
  apiKey: string
  model: {
    plan: string
    code: string
    chat: string
  }
  maxTokens: {
    input: number
    output: number
  }
}

export interface TokenBudgetConfig {
  maxPerProject: number
  warningThreshold: number
}

export interface ExecutionConfig {
  maxRetries: number
  timeout: number
  checkpointInterval: number
}

export interface SystemConfig {
  llm: LLMConfig
  tokenBudget: TokenBudgetConfig
  execution: ExecutionConfig
}
