import { writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'
import { ExecutionLock } from './types/agent'

const LOCK_FILE = join(process.cwd(), 'control', '.execution.lock')

export class ExecutionLockManager {
  private processId: number

  constructor() {
    this.processId = process.pid
  }

  async acquireLock(): Promise<boolean> {
    try {
      // Try to read existing lock
      try {
        const lockContent = await readFile(LOCK_FILE, 'utf-8')
        const lock: ExecutionLock = JSON.parse(lockContent)
        
        // Check if lock is stale (older than 5 minutes)
        if (lock.acquiredAt) {
          const lockAge = Date.now() - new Date(lock.acquiredAt).getTime()
          if (lockAge > 5 * 60 * 1000) {
            // Lock is stale, remove it
            await this.releaseLock()
          } else if (lock.processId !== this.processId) {
            // Another process has the lock
            return false
          }
        }
      } catch (error) {
        // Lock file doesn't exist, we can acquire it
      }

      // Acquire lock
      const lock: ExecutionLock = {
        acquired: true,
        acquiredAt: new Date(),
        processId: this.processId
      }
      
      await writeFile(LOCK_FILE, JSON.stringify(lock, null, 2), 'utf-8')
      return true
    } catch (error) {
      return false
    }
  }

  async releaseLock(): Promise<void> {
    try {
      await unlink(LOCK_FILE)
    } catch (error) {
      // Lock file might not exist, that's okay
    }
  }

  async isLocked(): Promise<boolean> {
    try {
      const lockContent = await readFile(LOCK_FILE, 'utf-8')
      const lock: ExecutionLock = JSON.parse(lockContent)
      
      if (lock.acquiredAt) {
        const lockAge = Date.now() - new Date(lock.acquiredAt).getTime()
        if (lockAge > 5 * 60 * 1000) {
          return false // Stale lock
        }
        return lock.processId !== this.processId
      }
      return false
    } catch (error) {
      return false
    }
  }
}
