import { ExecutionEngine } from '../../execution/engine'
import { StateWatcher } from '../../execution/watcher'

describe('Execution Flow Integration', () => {
  it('should handle state transitions', async () => {
    const watcher = new StateWatcher()
    await watcher.writeState('PLAN')
    const state = await watcher.readState()
    expect(state).toBe('PLAN')
    await watcher.stop()
  })
})
