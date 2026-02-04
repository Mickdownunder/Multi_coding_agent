import { NextRequest, NextResponse } from 'next/server'
import { ExecutionEngine } from '../../../../execution/engine'

let engine: ExecutionEngine | null = null

export async function POST(request: NextRequest) {
  try {
    if (!engine) {
      return NextResponse.json(
        { error: 'No execution running' },
        { status: 400 }
      )
    }

    await engine.stop()
    engine = null

    return NextResponse.json({ success: true, message: 'Execution stopped' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
