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
    let validation
    try {
      validation = await intentGenerator.validateIntent(intent)
    } catch (validationError) {
      return NextResponse.json(
        { 
          error: 'Failed to validate intent',
          details: validationError instanceof Error ? validationError.message : 'Unknown validation error'
        },
        { status: 500 }
      )
    }

    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Invalid intent', validation },
        { status: 400 }
      )
    }

    // Write intent
    try {
      await intentGenerator.writeIntent(intent)
    } catch (writeError) {
      return NextResponse.json(
        { 
          error: 'Failed to write intent',
          details: writeError instanceof Error ? writeError.message : 'Unknown write error'
        },
        { status: 500 }
      )
    }

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
    try {
      const { StateWatcher } = await import('../../../../execution/watcher')
      const watcher = new StateWatcher()
      await watcher.writeState('PLAN')
    } catch (stateError) {
      // Log but don't fail - intent was written successfully
      console.error('Failed to set state to PLAN:', stateError)
    }

    return NextResponse.json({ 
      success: true,
      message: 'Intent written and state set to PLAN. Old plan and report deleted. You can now start execution in the Monitor tab.'
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in generate-intent:', error)
    
    // Provide helpful error messages
    if (errorMessage.includes('API key') || errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { 
          error: 'API key configuration error',
          details: errorMessage,
          fix: 'Set GEMINI_API_KEY or OPENAI_API_KEY environment variable'
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
