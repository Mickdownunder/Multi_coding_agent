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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: 'state.txt not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to read state.txt' },
      { status: 500 }
    )
  }
}

// POST /api/state - Write new state
export async function POST(request: NextRequest) {
  try {
    const { state } = await request.json()
    
    const validStates = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL']
    if (!validStates.includes(state)) {
      return NextResponse.json(
        { error: `Invalid state. Must be one of: ${validStates.join(', ')}` },
        { status: 400 }
      )
    }
    
    await writeFile(STATE_FILE, state + '\n', 'utf-8')
    return NextResponse.json({ state })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to write state.txt' },
      { status: 500 }
    )
  }
}
