import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')

// GET /api/state - Read current state
export async function GET() {
  try {
    const content = await readFile(STATE_FILE, 'utf-8')
    const state = content.trim()
    return NextResponse.json({ state })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'state.txt not found in /control directory' },
        { status: 404 }
      )
    }
    const errorMessage = err.message || 'Unknown error'
    return NextResponse.json(
      { error: `Failed to read state.txt: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// HARD ENFORCEMENT: Explicit state transition map (The Law)
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PLAN: ['IMPLEMENT'],
  IMPLEMENT: ['VERIFY', 'FAIL'],
  VERIFY: ['DONE', 'PLAN', 'FAIL'],
  DONE: ['PLAN'],
  FAIL: ['PLAN']
}

// Helper to check if transition is allowed
function isTransitionAllowed(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || []
  return allowed.includes(to)
}

// POST /api/state - Write new state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { state, currentState } = body
    
    // Validate state value
    const validStates = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL']
    if (!state || typeof state !== 'string' || !validStates.includes(state)) {
      return NextResponse.json(
        { error: `Invalid state. Must be one of: ${validStates.join(', ')}` },
        { status: 400 }
      )
    }
    
    // HARD ENFORCEMENT: Read current state from file if not provided
    let actualCurrentState = currentState
    if (!actualCurrentState) {
      try {
        const currentContent = await readFile(STATE_FILE, 'utf-8')
        actualCurrentState = currentContent.trim()
      } catch {
        // File doesn't exist, assume PLAN
        actualCurrentState = 'PLAN'
      }
    }

    // HARD ENFORCEMENT: Check transition against ALLOWED_TRANSITIONS map
    if (actualCurrentState && validStates.includes(actualCurrentState)) {
      if (!isTransitionAllowed(actualCurrentState, state)) {
        const allowedTransitions = ALLOWED_TRANSITIONS[actualCurrentState] || []
        return NextResponse.json(
          { 
            error: `FORBIDDEN: Invalid transition from ${actualCurrentState} to ${state}`,
            allowedTransitions: allowedTransitions.length > 0 ? allowedTransitions : ['none'],
            currentState: actualCurrentState,
            requestedState: state
          },
          { status: 403 } // 403 Forbidden - policy violation
        )
      }
    }
    
    await writeFile(STATE_FILE, state + '\n', 'utf-8')
    return NextResponse.json({ state })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to write state.txt: ${errorMessage}` },
      { status: 500 }
    )
  }
}
