import { ErrorRecoveryService } from './recovery-service'
import { CheckpointService } from './checkpoint-service'
import { State } from '../types/agent'

export type ErrorCategory = 'llm' | 'file' | 'git' | 'validation' | 'system'

export interface ErrorInfo {
  category: ErrorCategory
  error: Error
  context?: Record<string, unknown>
  recoverable: boolean
}

export class ErrorHandler {
  private recoveryService: ErrorRecoveryService
  private checkpointService: CheckpointService

  constructor() {
    this.recoveryService = new ErrorRecoveryService()
    this.checkpointService = new CheckpointService()
  }

  async handleError(error: unknown, context?: Record<string, unknown>): Promise<ErrorInfo> {
    const errorInfo = this.categorizeError(error, context)
    
    // Log error
    await this.logError(errorInfo)

    // Attempt recovery if recoverable
    if (errorInfo.recoverable) {
      try {
        await this.recoveryService.recover(errorInfo)
      } catch (recoveryError) {
        console.error('Recovery failed:', recoveryError)
      }
    }

    return errorInfo
  }

  private categorizeError(error: unknown, context?: Record<string, unknown>): ErrorInfo {
    const err = error instanceof Error ? error : new Error(String(error))
    const message = err.message.toLowerCase()

    // LLM Errors
    if (message.includes('api') || message.includes('openai') || message.includes('rate limit') || message.includes('token')) {
      return {
        category: 'llm',
        error: err,
        context,
        recoverable: message.includes('rate limit') || message.includes('timeout')
      }
    }

    // File Errors
    if (message.includes('file') || message.includes('permission') || message.includes('enoent') || message.includes('disk')) {
      return {
        category: 'file',
        error: err,
        context,
        recoverable: message.includes('permission') || message.includes('enoent')
      }
    }

    // Git Errors
    if (message.includes('git') || message.includes('commit') || message.includes('merge') || message.includes('conflict')) {
      return {
        category: 'git',
        error: err,
        context,
        recoverable: message.includes('conflict') || message.includes('merge')
      }
    }

    // Validation Errors
    if (message.includes('validation') || message.includes('syntax') || message.includes('type') || message.includes('invalid')) {
      return {
        category: 'validation',
        error: err,
        context,
        recoverable: true // Validation errors are usually recoverable
      }
    }

    // System Errors (default)
    return {
      category: 'system',
      error: err,
      context,
      recoverable: message.includes('timeout') || message.includes('network')
    }
  }

  private async logError(errorInfo: ErrorInfo): Promise<void> {
    const logFile = `${process.cwd()}/control/execution.log`
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [ERROR] [${errorInfo.category}] ${errorInfo.error.message}\n${errorInfo.context ? JSON.stringify(errorInfo.context, null, 2) : ''}\n\n`

    try {
      const { appendFile } = await import('fs/promises')
      await appendFile(logFile, logEntry, 'utf-8')
    } catch (error) {
      console.error('Failed to log error:', error)
    }
  }

  async createRecoveryPlan(errorInfo: ErrorInfo, currentState: State): Promise<{
    plan: string
    steps: string[]
  }> {
    const steps: string[] = []

    switch (errorInfo.category) {
      case 'llm':
        steps.push('Check API key configuration')
        steps.push('Verify network connectivity')
        steps.push('Check token budget')
        if (errorInfo.error.message.includes('rate limit')) {
          steps.push('Wait and retry with exponential backoff')
        }
        break

      case 'file':
        steps.push('Check file permissions')
        steps.push('Verify disk space')
        steps.push('Check file paths')
        break

      case 'git':
        steps.push('Check Git repository state')
        steps.push('Resolve merge conflicts if any')
        steps.push('Verify Git configuration')
        break

      case 'validation':
        steps.push('Review validation errors')
        steps.push('Fix syntax/type errors')
        steps.push('Re-run validation')
        break

      case 'system':
        steps.push('Check system resources')
        steps.push('Verify network connectivity')
        steps.push('Check for system updates')
        break
    }

    return {
      plan: `Recovery plan for ${errorInfo.category} error`,
      steps
    }
  }
}
