import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { readFile as readProgress } from 'fs/promises'

const CONTROL_DIR = join(process.cwd(), 'control')
const PROGRESS_FILE = join(CONTROL_DIR, 'progress.json')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')

export async function GET() {
  try {
    // UI-WAHRHEIT: state.txt ist die einzige Quelle der Wahrheit
    const state = (await readFile(STATE_FILE, 'utf-8')).trim()
    
    let progress = { completedSteps: [] as string[] }
    try {
      const progressContent = await readProgress(PROGRESS_FILE, 'utf-8')
      progress = JSON.parse(progressContent)
    } catch {
      // Progress file doesn't exist
    }

    // UI-WAHRHEIT: Nur IMPLEMENT und VERIFY sind aktiv laufend
    // FAIL, DONE, PLAN = NICHT running (idle)
    // state.txt ist die einzige Quelle der Wahrheit
    const running = state === 'IMPLEMENT' || state === 'VERIFY'
    const idle = state === 'PLAN' || state === 'FAIL' || state === 'DONE'

    // Calculate progress percentage from plan.md
    let totalSteps = 0
    let completedSteps = progress.completedSteps.length
    
    try {
      const planContent = await readFile(join(CONTROL_DIR, 'plan.md'), 'utf-8')
      // Count all steps in plan (lines with "- [ ]" or "- [x]")
      const stepMatches = planContent.match(/- \[[ x]\]/g)
      totalSteps = stepMatches ? stepMatches.length : completedSteps
    } catch {
      // If plan doesn't exist, use completed steps as total (fallback)
      totalSteps = completedSteps
    }
    
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

    return NextResponse.json({
      state,
      running,
      idle,
      progress: {
        ...progress,
        totalSteps,
        completedSteps,
        progressPercent
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
