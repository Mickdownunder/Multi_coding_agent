import { CheckpointService } from './checkpoint-service'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { State } from '../types/agent'

const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')
const LOCK_FILE = join(CONTROL_DIR, '.execution.lock')

export class CrashRecoveryService {
  private checkpointService: CheckpointService

  constructor() {
    this.checkpointService = new CheckpointService()
  }

  async detectCrash(): Promise<boolean> {
    try {
      // Check if lock file exists (indicates interrupted execution)
      const { stat } = await import('fs/promises')
      try {
        await stat(LOCK_FILE)
        return true // Lock file exists, execution was interrupted
      } catch {
        return false // No lock file, no crash
      }
    } catch (error) {
      return false
    }
  }

  async recoverFromCrash(): Promise<{
    recovered: boolean
    checkpointId?: string
    state?: State
  }> {
    try {
      const latestCheckpoint = await this.checkpointService.getLatestCheckpoint()
      if (!latestCheckpoint) {
        return { recovered: false }
      }

      // Restore state
      await writeFile(STATE_FILE, latestCheckpoint.state + '\n', 'utf-8')

      // Remove lock file
      try {
        const { unlink } = await import('fs/promises')
        await unlink(LOCK_FILE)
      } catch {
        // Lock file might not exist
      }

      return {
        recovered: true,
        checkpointId: latestCheckpoint.id,
        state: latestCheckpoint.state
      }
    } catch (error) {
      console.error('Crash recovery failed:', error)
      return { recovered: false }
    }
  }

  async getRecoveryInfo(): Promise<{
    hasCrash: boolean
    lastCheckpoint?: {
      id: string
      timestamp: Date
      state: State
    }
  }> {
    const hasCrash = await this.detectCrash()
    const lastCheckpoint = await this.checkpointService.getLatestCheckpoint()

    return {
      hasCrash,
      lastCheckpoint: lastCheckpoint ? {
        id: lastCheckpoint.id,
        timestamp: lastCheckpoint.timestamp,
        state: lastCheckpoint.state
      } : undefined
    }
  }
}
