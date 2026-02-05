import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { ExecutionEngine } from '../../../../execution/engine'

const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')

// Global engine instance (shared across requests)
let engineInstance: ExecutionEngine | null = null

function getEngine(): ExecutionEngine {
  if (!engineInstance) {
    engineInstance = new ExecutionEngine()
  }
  return engineInstance
}

/**
 * POST /api/execute/reset
 * Force reset: Clear locks, flush queue, reset state to PLAN
 */
export async function POST(request: NextRequest) {
  try {
    const engine = getEngine()
    
    // Force reset engine (clear locks, flush queue)
    await engine.forceReset()
    
    // Reset state to PLAN
    await writeFile(STATE_FILE, 'PLAN\n', 'utf-8')
    
    return NextResponse.json({
      success: true,
      message: 'Execution reset to PLAN. Locks cleared, queue flushed.'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
