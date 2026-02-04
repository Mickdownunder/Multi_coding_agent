import { NextRequest, NextResponse } from 'next/server'
import { IntentGenerator } from '../../../../execution/services/intent-generator'
import { unlink } from 'fs/promises'
import { join } from 'path'

const intentGenerator = new IntentGenerator()
const CONTROL_DIR = join(process.cwd(), 'control')
const PLAN_FILE = join(CONTROL_DIR, 'plan.md')
const REPORT_FILE = join(CONTROL_DIR, 'report.md')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { intent } = body

    if (!intent) {
      return NextResponse.json(
        { error: 'Intent is required' },
        { status: 400 }
      )
    }

    // Validate intent
    const validation = await intentGenerator.validateIntent(intent)
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid intent', validation },
        { status: 400 }
      )
    }

    // Write intent
    await intentGenerator.writeIntent(intent)

    // Delete old plan.md and report.md when creating a new intent
    // This ensures the PlanAgent will generate a fresh plan based on the new intent
    try {
      await unlink(PLAN_FILE)
    } catch {
      // File doesn't exist, that's fine
    }
    try {
      await unlink(REPORT_FILE)
    } catch {
      // File doesn't exist, that's fine
    }

    // Set state to PLAN so execution can start
    const { StateWatcher } = await import('../../../../execution/watcher')
    const watcher = new StateWatcher()
    await watcher.writeState('PLAN')

    return NextResponse.json({ 
      success: true,
      message: 'Intent written and state set to PLAN. Old plan and report deleted. You can now start execution in the Monitor tab.'
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
