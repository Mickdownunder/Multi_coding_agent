import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')

// Files to clear (everything except rules.md)
const FILES_TO_CLEAR = ['intent.md', 'plan.md', 'report.md', 'state.txt']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { files } = body

    // If specific files provided, use those; otherwise clear all except rules.md
    const filesToClear = files || FILES_TO_CLEAR

    const cleared: string[] = []
    const errors: string[] = []

    for (const filename of filesToClear) {
      try {
        const filePath = join(CONTROL_DIR, filename)
        await unlink(filePath)
        cleared.push(filename)
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code !== 'ENOENT') {
          // File doesn't exist is OK, other errors are not
          errors.push(`${filename}: ${err.message}`)
        } else {
          cleared.push(filename) // File already doesn't exist, count as cleared
        }
      }
    }

    // Reset state.txt to PLAN
    try {
      const statePath = join(CONTROL_DIR, 'state.txt')
      const { writeFile } = await import('fs/promises')
      await writeFile(statePath, 'PLAN\n', 'utf-8')
    } catch (error) {
      errors.push(`state.txt: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return NextResponse.json({
      success: errors.length === 0,
      cleared,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
