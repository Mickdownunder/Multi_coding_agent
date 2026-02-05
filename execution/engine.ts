import { StateWatcher } from './watcher'
import { ExecutionQueue } from './queue'
import { CheckpointService } from './services/checkpoint-service'
import { ExecutionLockManager } from './lock'
import { recordProvenance } from './services/provenance-service'
import { State, Execution } from './types/agent'
import { Agent } from './agents/base'

export class ExecutionEngine {
  private watcher: StateWatcher
  private queue: ExecutionQueue
  private lockManager: ExecutionLockManager
  private checkpointService: CheckpointService
  private currentExecution: Execution | null = null
  private agents: Map<State, () => Agent> = new Map()
  private running = false
  private lastKnownState: State | null = null
  private onExecutionStart?: (execution: Execution) => void
  private onExecutionComplete?: (execution: Execution) => void
  private onExecutionError?: (execution: Execution, error: Error) => void

  constructor() {
    this.watcher = new StateWatcher()
    this.queue = new ExecutionQueue()
    this.lockManager = new ExecutionLockManager()
    this.checkpointService = new CheckpointService()
  }

  registerAgent(state: State, agentFactory: () => Agent): void {
    this.agents.set(state, agentFactory)
  }

  async start(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true

    // Log engine start
    await this.logToFile('[ExecutionEngine] Starting execution engine')

    // Check for crash recovery
    await this.recoverFromCrash()

    // Start watching for state changes
    await this.watcher.watch(async (newState: State) => {
      await this.logToFile(`[ExecutionEngine] State changed to: ${newState}`)
      await this.onStateChange(newState)
    })

    // Process current state immediately (don't wait for change)
    try {
      const currentState = await this.watcher.readState()
      this.lastKnownState = currentState
      await this.logToFile(`[ExecutionEngine] Current state: ${currentState}`)
      // Only process if state is not an end state (DONE, FAIL)
      if (currentState && currentState !== 'DONE' && currentState !== 'FAIL') {
        await this.logToFile(`[ExecutionEngine] Processing initial state: ${currentState}`)
        await this.onStateChange(currentState)
      } else if (currentState === 'DONE' || currentState === 'FAIL') {
        await this.logToFile(`[ExecutionEngine] Current state is ${currentState} (end state), execution stopped`)
        this.running = false
      }
    } catch (error) {
      await this.logToFile(`[ExecutionEngine] Error reading initial state: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Process queue
    this.processQueue()
  }

  async stop(): Promise<void> {
    this.running = false
    await this.watcher.stop()
    await this.lockManager.releaseLock()
  }

  /**
   * FORCE-RESET: Clear all locks, flush queue, and reset execution state
   * Used for manual recovery from FAIL state
   */
  async forceReset(): Promise<void> {
    await this.logToFile('[ExecutionEngine] FORCE-RESET: Clearing locks, flushing queue, resetting execution')
    
    // Clear all locks
    await this.lockManager.releaseLock()
    
    // Flush queue
    this.queue.clear()
    this.queue.setProcessing(false)
    
    // Reset current execution
    this.currentExecution = null
    
    // Reset running flag
    this.running = false
    
    await this.logToFile('[ExecutionEngine] FORCE-RESET: Complete')
  }

  private async onStateChange(newState: State): Promise<void> {
    // FORCE-RESET: If state changes from FAIL/DONE to PLAN/IMPLEMENT, reset everything
    const previousState = this.lastKnownState
    if ((previousState === 'FAIL' || previousState === 'DONE') && 
        (newState === 'PLAN' || newState === 'IMPLEMENT' || newState === 'VERIFY')) {
      await this.logToFile(`[ExecutionEngine] FORCE-RESET: State changed from ${previousState} to ${newState}, clearing locks and queue`)
      
      // Clear all locks
      await this.lockManager.releaseLock()
      
      // Flush queue
      this.queue.clear()
      this.queue.setProcessing(false)
      
      // Reset current execution
      this.currentExecution = null
      
      // Resume execution
      this.running = true
    }
    
    this.lastKnownState = newState
    
    // FAIL and DONE are end states - don't process them
    if (newState === 'FAIL' || newState === 'DONE') {
      await this.logToFile(`[ExecutionEngine] State changed to ${newState} (end state), stopping execution`)
      this.running = false
      return
    }
    
    // Don't re-queue if we're already processing this state
    if (this.currentExecution && this.currentExecution.state === newState) {
      await this.logToFile(`[ExecutionEngine] Already processing state ${newState}, skipping`)
      return
    }
    
    // Enqueue state change
    await this.logToFile(`[ExecutionEngine] State changed to ${newState}, enqueueing`)
    this.queue.enqueue(newState)
  }

  private async processQueue(): Promise<void> {
    while (this.running) {
      if (this.queue.isProcessing()) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      const item = this.queue.dequeue()
      if (!item) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }

      this.queue.setProcessing(true)

      // Skip end states (FAIL, DONE) - they don't have agents
      if (item.state === 'FAIL' || item.state === 'DONE') {
        await this.logToFile(`[ExecutionEngine] Skipping end state ${item.state} - no agent needed`)
        this.queue.setProcessing(false)
        continue
      }

      try {
        await this.executeState(item.state as State)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        await this.logToFile(`[ExecutionEngine] Error executing state ${item.state}: ${errorMessage}`)
        
        // Log to execution.log
        try {
          const { appendFile } = await import('fs/promises')
          const { join } = await import('path')
          const logFile = join(process.cwd(), 'control', 'execution.log')
          const timestamp = new Date().toISOString()
          await appendFile(logFile, `[${timestamp}] [ERROR] [ExecutionEngine] Error executing state ${item.state}: ${errorMessage}\n`, 'utf-8')
        } catch (logError) {
          console.error('Failed to write error to log:', logError)
        }
        
        // Set state to FAIL on error (this is an end state, don't process it)
        try {
          await this.watcher.writeState('FAIL')
          await this.logToFile(`[ExecutionEngine] State set to FAIL due to error`)
          // Stop execution - FAIL is an end state
          this.running = false
        } catch (stateError) {
          await this.logToFile(`[ExecutionEngine] Failed to set state to FAIL: ${stateError instanceof Error ? stateError.message : String(stateError)}`)
        }
        
        // Don't retry automatically - user must manually restart
        await this.logToFile(`[ExecutionEngine] Execution stopped due to error. State set to FAIL.`)
      } finally {
        this.queue.setProcessing(false)
      }
    }
  }

  private async executeState(state: State): Promise<void> {
    // Log to file instead of console to reduce terminal noise
    await this.logToFile(`[ExecutionEngine] Executing state: ${state}`)
    
    // Check if we can acquire lock
    const acquired = await this.lockManager.acquireLock()
    if (!acquired) {
      await this.logToFile(`[ExecutionEngine] Could not acquire lock, re-queuing state: ${state}`)
      // Another execution is running, re-queue
      this.queue.enqueue(state, 1) // Higher priority for retry
      return
    }

    try {
      await this.logToFile(`[ExecutionEngine] Lock acquired for state: ${state}`)
      
      // Create checkpoint before execution
      const checkpointId = await this.checkpointService.createCheckpoint(state)

      // Create execution record
      const execution: Execution = {
        id: `exec-${Date.now()}`,
        state,
        agent: state,
        startedAt: new Date()
      }

      this.currentExecution = execution
      if (this.onExecutionStart) {
        this.onExecutionStart(execution)
      }

      // ENGINE STABILITY: Jeder Zugriff mit Safe Navigation abgesichert
      if (!this.agents || typeof this.agents.get !== 'function') {
        await this.logToFile(`[ExecutionEngine] ERROR: agents Map is not initialized or invalid`)
        throw new Error(`ExecutionEngine: agents Map is not initialized`)
      }
      
      // SAFE NAVIGATION: Prüfe ob State registriert ist
      const agentFactory = this.agents?.get?.(state)
      if (!agentFactory || typeof agentFactory !== 'function') {
        await this.logToFile(`[ExecutionEngine] ERROR: No valid agent factory for state: ${state}`)
        throw new Error(`No agent registered for state: ${state}`)
      }

      await this.logToFile(`[ExecutionEngine] Creating agent for state: ${state}`)
      
      // SAFE NAVIGATION: Prüfe ob agentFactory eine Funktion ist
      if (typeof agentFactory !== 'function') {
        throw new Error(`Agent factory for state ${state} is not a function`)
      }
      
      const agent = agentFactory()
      
      // SAFE NAVIGATION: Prüfe ob agent erstellt wurde
      if (!agent) {
        throw new Error(`Agent factory for state ${state} returned null/undefined`)
      }

      // ENGINE STABILITY: Safe Navigation für validate()
      let canRun = false
      try {
        if (agent && typeof agent.validate === 'function') {
          canRun = await agent.validate()
        } else {
          await this.logToFile(`[ExecutionEngine] WARNING: Agent has no validate() method, skipping validation`)
          canRun = true // Default to true if no validation method
        }
      } catch (validationError) {
        await this.logToFile(`[ExecutionEngine] ERROR: Agent validation threw error: ${validationError instanceof Error ? validationError.message : String(validationError)}`)
        throw new Error(`Agent validation failed for state: ${state}: ${validationError instanceof Error ? validationError.message : String(validationError)}`)
      }
      
      if (!canRun) {
        throw new Error(`Agent validation failed for state: ${state}`)
      }

      await this.logToFile(`[ExecutionEngine] Agent validated, starting execution`)
      // ENGINE STABILITY: Safe Navigation für alle Agent-Methoden
      // Run agent
      if (agent && typeof agent.onEnter === 'function') {
        try {
          await agent.onEnter()
        } catch (onEnterError) {
          await this.logToFile(`[ExecutionEngine] WARNING: agent.onEnter() failed: ${onEnterError instanceof Error ? onEnterError.message : String(onEnterError)}`)
          // Continue execution even if onEnter fails
        }
      }
      
      try {
        if (agent && typeof agent.execute === 'function') {
          await agent.execute()
          await this.logToFile(`[ExecutionEngine] Agent execute() completed successfully`)
        } else {
          throw new Error(`Agent has no execute() method`)
        }
      } catch (error) {
        await this.logToFile(`[ExecutionEngine] Agent execute() failed: ${error instanceof Error ? error.message : String(error)}`)
        throw error
      } finally {
        // ENGINE STABILITY: Safe Navigation für onExit()
        if (agent && typeof agent.onExit === 'function') {
          try {
            await agent.onExit()
          } catch (onExitError) {
            await this.logToFile(`[ExecutionEngine] WARNING: agent.onExit() failed: ${onExitError instanceof Error ? onExitError.message : String(onExitError)}`)
            // Don't throw - onExit errors shouldn't fail execution
          }
        }
      }
      
      await this.logToFile(`[ExecutionEngine] Agent execution completed for state: ${state}`)

      // Mark execution as complete
      execution.completedAt = new Date()
      this.currentExecution = null

      // Record execution provenance for audit trail
      await recordProvenance(
        execution.id,
        execution.startedAt,
        execution.completedAt,
        state
      ).catch(() => { /* non-fatal */ })

      if (this.onExecutionComplete) {
        this.onExecutionComplete(execution)
      }
    } catch (error) {
      const execution = this.currentExecution || {
        id: `exec-${Date.now()}`,
        state,
        agent: state,
        startedAt: new Date()
      }

      execution.error = error instanceof Error ? error : new Error(String(error))
      execution.completedAt = new Date()
      this.currentExecution = null

      if (this.onExecutionError) {
        this.onExecutionError(execution, execution.error)
      }

      throw error
    } finally {
      await this.lockManager.releaseLock()
    }
  }

  async recoverFromCrash(): Promise<void> {
    try {
      const latestCheckpoint = await this.checkpointService.getLatestCheckpoint()
      if (latestCheckpoint) {
        // Check if execution was interrupted
        const isLocked = await this.lockManager.isLocked()
        if (isLocked) {
          // Execution was interrupted, we can resume from checkpoint
          await this.logToFile(`Recovering from checkpoint: ${latestCheckpoint.id}`)
          // The state watcher will pick up the current state and continue
        }
      }
    } catch (error) {
      await this.logToFile(`Error during crash recovery: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  getCurrentExecution(): Execution | null {
    return this.currentExecution
  }

  setOnExecutionStart(callback: (execution: Execution) => void): void {
    this.onExecutionStart = callback
  }

  setOnExecutionComplete(callback: (execution: Execution) => void): void {
    this.onExecutionComplete = callback
  }

  setOnExecutionError(callback: (execution: Execution, error: Error) => void): void {
    this.onExecutionError = callback
  }

  private async logToFile(message: string): Promise<void> {
    try {
      const { appendFile } = await import('fs/promises')
      const { join } = await import('path')
      const logFile = join(process.cwd(), 'control', 'execution.log')
      const timestamp = new Date().toISOString()
      await appendFile(logFile, `[${timestamp}] ${message}\n`, 'utf-8')
    } catch (error) {
      // Silently fail - don't spam console
    }
  }
}
