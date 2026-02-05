import { StateWatcher } from '../../execution/watcher'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')

describe('Execution Flow Integration', () => {
  it('should handle state transitions', async () => {
    const watcher = new StateWatcher()
    // Ensure we're in DONE or FAIL so we can transition to PLAN (allowed: DONE->PLAN, FAIL->PLAN)
    await writeFile(STATE_FILE, 'DONE\n', 'utf-8')
    await watcher.writeState('PLAN')
    const state = await watcher.readState()
    expect(state).toBe('PLAN')
    await watcher.stop()
  })
})
