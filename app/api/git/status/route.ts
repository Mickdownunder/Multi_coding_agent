import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'

const execAsync = promisify(exec)

export async function GET() {
  try {
    // Check if Git is initialized
    try {
      const { stdout: gitDirOut } = await execAsync('git rev-parse --git-dir')
      const gitDir = gitDirOut.trim()
      const absPath = join(process.cwd(), gitDir === '.git' ? '.git' : gitDir)
      
      // Get current branch
      let branch = 'main'
      try {
        const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD')
        branch = branchOut.trim()
      } catch {
        // Branch detection failed, use default
      }
      
      // Get latest commit hash
      let hash = ''
      try {
        const { stdout: hashOut } = await execAsync('git rev-parse HEAD')
        hash = hashOut.trim()
      } catch {
        // No commits yet
      }
      
      return NextResponse.json({
        initialized: true,
        path: absPath.replace(process.cwd() + '/', ''),
        branch: branch || 'main',
        hash: hash || 'N/A'
      })
    } catch {
      return NextResponse.json({
        initialized: false,
        path: '',
        branch: 'main',
        hash: 'N/A'
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
