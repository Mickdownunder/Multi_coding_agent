import { ErrorHandler, ErrorInfo } from './error-handler'
import { CheckpointService } from './checkpoint-service'
import { State } from '../types/agent'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')

export class ErrorRecoveryService {
  private errorHandler: ErrorHandler
  private checkpointService: CheckpointService

  constructor() {
    this.errorHandler = new ErrorHandler()
    this.checkpointService = new CheckpointService()
  }

  async recover(errorInfo: ErrorInfo): Promise<boolean> {
    try {
      switch (errorInfo.category) {
        case 'llm':
          return await this.recoverLLMError(errorInfo)
        case 'file':
          return await this.recoverFileError(errorInfo)
        case 'git':
          return await this.recoverGitError(errorInfo)
        case 'validation':
          return await this.recoverValidationError(errorInfo)
        case 'system':
          return await this.recoverSystemError(errorInfo)
        default:
          return false
      }
    } catch (error) {
      console.error('Recovery failed:', error)
      return false
    }
  }

  private async recoverLLMError(errorInfo: ErrorInfo): Promise<boolean> {
    // For rate limits, wait and retry
    if (errorInfo.error.message.includes('rate limit')) {
      await new Promise(resolve => setTimeout(resolve, 60000)) // Wait 1 minute
      return true
    }

    // For token errors, check budget
    if (errorInfo.error.message.includes('token')) {
      // Budget service will handle this
      return false // Can't auto-recover token budget issues
    }

    return false
  }

  private async recoverFileError(errorInfo: ErrorInfo): Promise<boolean> {
    // File errors are usually not auto-recoverable
    // User intervention needed
    return false
  }

  private async recoverGitError(errorInfo: ErrorInfo): Promise<boolean> {
    // Git conflicts need user intervention
    if (errorInfo.error.message.includes('conflict')) {
      return false
    }

    // Other git errors might be recoverable
    return false
  }

  private async recoverValidationError(errorInfo: ErrorInfo): Promise<boolean> {
    // Validation errors are usually recoverable by fixing the code
    // But we can't auto-fix them
    return false
  }

  private async recoverSystemError(errorInfo: ErrorInfo): Promise<boolean> {
    // System errors might be recoverable with retry
    if (errorInfo.error.message.includes('timeout') || errorInfo.error.message.includes('network')) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      return true
    }

    return false
  }

  async generateRecoveryPlan(errorInfo: ErrorInfo, currentState: State): Promise<void> {
    const plan = await this.errorHandler.createRecoveryPlan(errorInfo, currentState)
    
    const planContent = `# Recovery Plan

Generated: ${new Date().toISOString()}
Error: ${errorInfo.category} - ${errorInfo.error.message}

## Steps

${plan.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
`

    await writeFile(join(CONTROL_DIR, 'recovery-plan.md'), planContent, 'utf-8')
  }

  async rollbackToCheckpoint(checkpointId: string): Promise<boolean> {
    try {
      const checkpoint = await this.checkpointService.getCheckpoint(checkpointId)
      if (!checkpoint) {
        return false
      }

      // Restore state
      await writeFile(join(CONTROL_DIR, 'state.txt'), checkpoint.state + '\n', 'utf-8')

      // Git rollback would be handled by GitService
      return true
    } catch (error) {
      console.error('Rollback failed:', error)
      return false
    }
  }
}
