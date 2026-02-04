import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { readdir, stat } from 'fs/promises'

const CONTROL_DIR = join(process.cwd(), 'control')
const PROGRESS_FILE = join(CONTROL_DIR, 'progress.json')

interface CreatedFile {
  path: string
  size: number
  createdAt: string
  stepId?: string
}

export async function GET() {
  try {
    // Read progress to get recently completed steps
    let progress = { completedSteps: [] as string[] }
    try {
      const progressContent = await readFile(PROGRESS_FILE, 'utf-8')
      progress = JSON.parse(progressContent)
    } catch {
      // Progress file doesn't exist
    }

    // Get recently created/modified files
    // Check if there's an execution start time, otherwise use last 60 minutes
    const recentFiles: CreatedFile[] = []
    const now = Date.now()
    
    // Try to get execution start time from lock file or progress file
    let executionStartTime = now - (60 * 60 * 1000) // Default: last 60 minutes
    try {
      const lockFile = join(CONTROL_DIR, '.execution.lock')
      const lockStats = await stat(lockFile)
      executionStartTime = lockStats.mtime.getTime()
    } catch {
      // Lock file doesn't exist, try to get from progress file
      try {
        const progressStats = await stat(PROGRESS_FILE)
        executionStartTime = progressStats.mtime.getTime()
      } catch {
        // Progress file doesn't exist, use default
      }
    }

    // Scan common directories for recently modified files
    const directoriesToScan = [
      join(process.cwd(), 'app'),
      join(process.cwd(), 'components'),
      join(process.cwd(), 'lib'),
      join(process.cwd(), 'types'),
      join(process.cwd(), 'execution')
    ]

    for (const dir of directoriesToScan) {
      try {
        const files = await getRecentFiles(dir, executionStartTime)
        recentFiles.push(...files)
      } catch {
        // Directory doesn't exist or can't be read
      }
    }
    
    // Also check for files in subdirectories that might have been created
    // Specifically check app/components/todo, app/api/todos, lib directories
    const specificDirs = [
      join(process.cwd(), 'app', 'components', 'todo'),
      join(process.cwd(), 'app', 'api', 'todos'),
      join(process.cwd(), 'lib'),
      join(process.cwd(), 'app', 'todo')
    ]
    
    for (const dir of specificDirs) {
      try {
        const files = await getRecentFiles(dir, executionStartTime)
        recentFiles.push(...files)
      } catch {
        // Directory doesn't exist or can't be read
      }
    }

    // Sort by modification time (newest first)
    recentFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      files: recentFiles.slice(0, 20), // Return top 20 most recent
      totalCreated: recentFiles.length
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

async function getRecentFiles(dir: string, since: number): Promise<CreatedFile[]> {
  const files: CreatedFile[] = []
  
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories (limit depth to 3 levels)
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
          const subFiles = await getRecentFiles(fullPath, since)
          files.push(...subFiles)
        }
      } else if (entry.isFile()) {
        try {
          const stats = await stat(fullPath)
          // Check both mtime (modification) and ctime (creation) for new files
          const mtime = stats.mtime.getTime()
          const ctime = stats.ctime.getTime()
          const fileTime = Math.max(mtime, ctime)
          
          if (fileTime >= since) {
            files.push({
              path: fullPath.replace(process.cwd() + '/', ''), // Relative path
              size: stats.size,
              createdAt: new Date(fileTime).toISOString()
            })
          }
        } catch {
          // Can't read file stats
        }
      }
    }
  } catch {
    // Can't read directory - might not exist yet
  }
  
  return files
}
