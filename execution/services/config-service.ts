import { Config } from '../config'
import { SystemConfig } from '../types/config'

export class ConfigService {
  private config: Config

  constructor() {
    this.config = Config.getInstance()
  }

  async loadConfig(): Promise<SystemConfig> {
    return await this.config.load()
  }

  async validateAPIKeys(): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      
      // Validate API key is set
      if (!config.llm.apiKey || config.llm.apiKey.length === 0) {
        throw new Error('LLM API key is not set')
      }

      // Validate API key format (basic check)
      if (config.llm.provider === 'openai' && !config.llm.apiKey.startsWith('sk-')) {
        console.warn('OpenAI API key format may be invalid')
      }

      if (config.llm.provider === 'anthropic' && !config.llm.apiKey.startsWith('sk-ant-')) {
        console.warn('Anthropic API key format may be invalid')
      }

      return true
    } catch (error) {
      console.error('API key validation failed:', error)
      return false
    }
  }

  getConfig(): SystemConfig {
    return this.config.getConfig()
  }

  getLLMConfig() {
    return this.config.getLLMConfig()
  }

  getTokenBudgetConfig() {
    return this.config.getTokenBudgetConfig()
  }

  getExecutionConfig() {
    return this.config.getExecutionConfig()
  }

  // Never log API keys
  getConfigForLogging(): Omit<SystemConfig, 'llm'> & { llm: Omit<SystemConfig['llm'], 'apiKey'> & { apiKey: '[REDACTED]' } } {
    const config = this.getConfig()
    return {
      ...config,
      llm: {
        ...config.llm,
        apiKey: '[REDACTED]'
      }
    }
  }
}
