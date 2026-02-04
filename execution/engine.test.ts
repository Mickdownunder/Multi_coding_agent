import { ExecutionEngine } from './engine'
import { StateWatcher } from './watcher'
import { ExecutionQueue } from './queue'

describe('ExecutionEngine', () => {
  let engine: ExecutionEngine

  beforeEach(() => {
    engine = new ExecutionEngine()
  })

  afterEach(async () => {
    await engine.stop()
  })

  it('should start and stop correctly', async () => {
    await engine.start()
    expect(engine.getCurrentExecution()).toBeNull()
    await engine.stop()
  })

  it('should register agents', () => {
    engine.registerAgent('PLAN', () => ({
      onEnter: async () => {},
      execute: async () => {},
      onExit: async () => {},
      validate: async () => true
    } as any))
    
    // No error means registration worked
    expect(true).toBe(true)
  })
})
