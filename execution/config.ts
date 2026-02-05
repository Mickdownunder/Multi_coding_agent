import { readFile } from 'fs/promises'
import { join } from 'path'
import { SystemConfig } from './types/config'

const CONFIG_FILE = join(process.cwd(), 'control', 'config.json')

export class Config {
  private static instance: Config
  private config: SystemConfig | null = null

  private constructor() {}

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config()
    }
    return Config.instance
  }

  async load(): Promise<SystemConfig> {
    if (this.config) {
      return this.config
    }

    try {
      const content = await readFile(CONFIG_FILE, 'utf-8')
      const parsedConfig = JSON.parse(content) as Partial<SystemConfig>
      
      // Ensure workspace config exists with defaults
      if (!parsedConfig.workspace) {
        parsedConfig.workspace = {
          projectPath: '/Users/michaellabitzke/agent-workspace',
          autoInit: true
        }
      }
      
      this.config = parsedConfig as SystemConfig
      
      // Resolve environment variable references
      this.config = await this.resolveEnvVars(this.config)
      
      return this.config
    } catch (error) {
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async resolveEnvVars(config: SystemConfig): Promise<SystemConfig> {
    const resolved = { ...config }

    // Resolve API key
    if (resolved.llm.apiKey.startsWith('env:')) {
      const envVar = resolved.llm.apiKey.substring(4)
      const value = process.env[envVar]
      if (!value) {
        throw new Error(`Environment variable ${envVar} is not set`)
      }
      resolved.llm.apiKey = value
    }

    // Override with environment variables if set
    if (process.env.MAX_TOKEN_BUDGET) {
      resolved.tokenBudget.maxPerProject = parseInt(process.env.MAX_TOKEN_BUDGET, 10)
    }

    if (process.env.EXECUTION_TIMEOUT) {
      resolved.execution.timeout = parseInt(process.env.EXECUTION_TIMEOUT, 10)
    }

    return resolved
  }

  getConfig(): SystemConfig {
    if (!this.config) {
      throw new Error('Config not loaded. Call load() first.')
    }
    return this.config
  }

  getLLMConfig() {
    return this.getConfig().llm
  }

  getTokenBudgetConfig() {
    return this.getConfig().tokenBudget
  }

  getExecutionConfig() {
    return this.getConfig().execution
  }

  getWorkspaceConfig() {
    return this.getConfig().workspace
  }

  getProjectPath(): string {
    return this.getWorkspaceConfig().projectPath
  }
}
