import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Check if Git is initialized
    try {
      const { stdout } = await execAsync('git rev-parse --git-dir')
      const gitDir = stdout.trim()
      const absPath = join(process.cwd(), gitDir === '.git' ? '.git' : gitDir)
      
      return NextResponse.json({
        initialized: true,
        path: absPath.replace(process.cwd() + '/', '')
      })
    } catch {
      return NextResponse.json({
        initialized: false,
        path: ''
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
