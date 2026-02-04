import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'

const METRICS_FILE = join(process.cwd(), 'control', 'metrics.json')

export interface Metrics {
  tokenUsage: {
    total: number
    byCategory: {
      plan: number
      code: number
      chat: number
    }
  }
  executionTime: {
    total: number
    byState: {
      PLAN: number
      IMPLEMENT: number
      VERIFY: number
    }
  }
  errorRates: {
    total: number
    byCategory: {
      llm: number
      file: number
      git: number
      validation: number
      system: number
    }
  }
  successRates: {
    plan: number
    implement: number
    verify: number
  }
  costPerProject: number
  lastUpdated: string
}

export class MetricsService {
  private metrics: Metrics | null = null

  async loadMetrics(): Promise<Metrics> {
    if (this.metrics) {
      return this.metrics
    }

    try {
      const content = await readFile(METRICS_FILE, 'utf-8')
      this.metrics = JSON.parse(content) as Metrics
      return this.metrics
    } catch {
      // Create default metrics
      this.metrics = {
        tokenUsage: {
          total: 0,
          byCategory: {
            plan: 0,
            code: 0,
            chat: 0
          }
        },
        executionTime: {
          total: 0,
          byState: {
            PLAN: 0,
            IMPLEMENT: 0,
            VERIFY: 0
          }
        },
        errorRates: {
          total: 0,
          byCategory: {
            llm: 0,
            file: 0,
            git: 0,
            validation: 0,
            system: 0
          }
        },
        successRates: {
          plan: 0,
          implement: 0,
          verify: 0
        },
        costPerProject: 0,
        lastUpdated: new Date().toISOString()
      }
      await this.saveMetrics()
      return this.metrics
    }
  }

  async saveMetrics(): Promise<void> {
    if (!this.metrics) {
      return
    }

    this.metrics.lastUpdated = new Date().toISOString()
    await writeFile(METRICS_FILE, JSON.stringify(this.metrics, null, 2), 'utf-8')
  }

  async recordTokenUsage(category: 'plan' | 'code' | 'chat', tokens: number): Promise<void> {
    const metrics = await this.loadMetrics()
    metrics.tokenUsage.total += tokens
    metrics.tokenUsage.byCategory[category] += tokens
    this.metrics = metrics
    await this.saveMetrics()
  }

  async recordExecutionTime(state: 'PLAN' | 'IMPLEMENT' | 'VERIFY', time: number): Promise<void> {
    const metrics = await this.loadMetrics()
    metrics.executionTime.total += time
    metrics.executionTime.byState[state] += time
    this.metrics = metrics
    await this.saveMetrics()
  }

  async recordError(category: 'llm' | 'file' | 'git' | 'validation' | 'system'): Promise<void> {
    const metrics = await this.loadMetrics()
    metrics.errorRates.total++
    metrics.errorRates.byCategory[category]++
    this.metrics = metrics
    await this.saveMetrics()
  }

  async recordSuccess(phase: 'plan' | 'implement' | 'verify'): Promise<void> {
    const metrics = await this.loadMetrics()
    // Simple success rate tracking
    metrics.successRates[phase]++
    this.metrics = metrics
    await this.saveMetrics()
  }

  async recordCost(cost: number): Promise<void> {
    const metrics = await this.loadMetrics()
    metrics.costPerProject = cost
    this.metrics = metrics
    await this.saveMetrics()
  }

  async getMetrics(): Promise<Metrics> {
    return await this.loadMetrics()
  }
}
