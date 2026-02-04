import { readFile, writeFile, watch } from 'fs/promises'
import { join } from 'path'
import { State } from './types/agent'
import { ExecutionLockManager } from './lock'

const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')

export class StateWatcher {
  private lockManager: ExecutionLockManager
  private lastState: State | null = null
  private pollInterval: NodeJS.Timeout | null = null
  private watcher: AsyncIterable<unknown> | null = null
  private onChangeCallback?: (newState: State) => Promise<void>

  constructor() {
    this.lockManager = new ExecutionLockManager()
  }

  async readState(): Promise<State> {
    try {
      const content = await readFile(STATE_FILE, 'utf-8')
      const state = content.trim() as State
      return state
    } catch (error) {
      throw new Error(`Failed to read state: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async writeState(state: State): Promise<void> {
    // Acquire lock before writing
    const acquired = await this.lockManager.acquireLock()
    if (!acquired) {
      throw new Error('Could not acquire lock to write state')
    }

    try {
      await writeFile(STATE_FILE, state + '\n', 'utf-8')
      this.lastState = state
    } finally {
      await this.lockManager.releaseLock()
    }
  }

  async watch(onChange: (newState: State) => Promise<void>): Promise<void> {
    this.onChangeCallback = onChange
    
    // Read initial state
    this.lastState = await this.readState()

    // Start polling (hybrid approach: polling + file watching)
    this.startPolling()
    
    // Also try file system watching (may not work on all systems)
    try {
      this.startFileWatching()
    } catch (error) {
      // File watching not available, polling will handle it
      console.warn('File system watching not available, using polling only')
    }
  }

  private startPolling(): void {
    const POLL_INTERVAL = 1000 // 1 second
    
    this.pollInterval = setInterval(async () => {
      try {
        const currentState = await this.readState()
        if (currentState !== this.lastState) {
          this.lastState = currentState
          if (this.onChangeCallback) {
            await this.onChangeCallback(currentState)
          }
        }
      } catch (error) {
        console.error('Error polling state:', error)
      }
    }, POLL_INTERVAL)
  }

  private async startFileWatching(): Promise<void> {
    try {
      this.watcher = watch(STATE_FILE)
      
      // Note: File watching in Node.js is complex and may not work reliably
      // Polling is more reliable, so we use it as primary method
    } catch (error) {
      // Ignore file watching errors, polling will handle it
    }
  }

  async stop(): Promise<void> {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
    
    // File watcher cleanup would go here if we implement it properly
    this.watcher = null
    this.onChangeCallback = undefined
  }

  getLastState(): State | null {
    return this.lastState
  }
}
