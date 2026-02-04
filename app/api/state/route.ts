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

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  PLAN: ['IMPLEMENT'],
  IMPLEMENT: ['VERIFY', 'FAIL'],
  VERIFY: ['DONE', 'PLAN', 'FAIL'],
  DONE: ['PLAN'],
  FAIL: ['PLAN']
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
    
    // Validate state transition if currentState is provided
    if (currentState && typeof currentState === 'string' && validStates.includes(currentState)) {
      const allowedTransitions = VALID_TRANSITIONS[currentState] || []
      if (!allowedTransitions.includes(state)) {
        return NextResponse.json(
          { error: `Invalid transition from ${currentState} to ${state}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}` },
          { status: 400 }
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
