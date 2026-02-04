import { ContextService } from './context-service'
import { Context, Codebase } from '../types/context'

export class ContextManager {
  private contextService: ContextService
  private currentContext: Context | null = null

  constructor() {
    this.contextService = new ContextService()
  }

  async getContext(): Promise<Context> {
    if (this.currentContext) {
      return this.currentContext
    }

    this.currentContext = await this.contextService.loadContext()
    return this.currentContext
  }

  async getCodebase(): Promise<Codebase> {
    return await this.contextService.getCodebase()
  }

  async updateContext(changes: Array<{ path: string; type: 'created' | 'modified' | 'deleted' }>): Promise<Context> {
    this.currentContext = await this.contextService.updateContext(changes)
    return this.currentContext
  }

  clearCache(): void {
    this.currentContext = null
  }
}
