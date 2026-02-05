import { NextRequest, NextResponse } from 'next/server'
import { readdir, unlink, rmdir } from 'fs/promises'
import { join, resolve } from 'path'
import { Config } from '../../../../execution/config'

// Directories to scan for created files - uses workspace path from config
// Agent writes to workspace.projectPath/apps/, so we must scan there (not process.cwd())
async function getScanDirectories(): Promise<string[]> {
  const projectRoot = process.cwd()
  try {
    const config = Config.getInstance()
    await config.load()
    const workspacePath = resolve(config.getWorkspaceConfig().projectPath)
    const projectRootResolved = resolve(projectRoot)
    // If workspace is same as project root, use relative path
    if (workspacePath === projectRootResolved) {
      return [join(projectRoot, 'apps')]
    }
    // Workspace is external (e.g. agent-workspace) - scan workspace/apps
    return [join(workspacePath, 'apps')]
  } catch {
    // Fallback: scan process.cwd()/apps if config fails
    return [join(projectRoot, 'apps')]
  }
}

// Files/directories to NEVER delete
const PROTECTED_PATTERNS = [
  'node_modules',
  '.next',
  '.git',
  'control',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'next.config.js',
  'tailwind.config.js',
  'postcss.config.js',
  'jest.config.js',
  'playwright.config.ts',
  'README.md',
  'ANLEITUNG.md',
  'SETUP.md',
  'QUICKSTART.md',
  'NEXT_STEPS.md',
  'app/page.tsx', // Keep main dashboard
  'app/layout.tsx',
  'app/globals.css',
  'app/error.tsx',
  'app/api', // Keep API routes (they're part of the system)
  'components/DashboardLayout.tsx',
  'components/TodoForm.tsx',
  'components/TodoItem.tsx',
  'components/TodoList.tsx',
  'execution', // Keep execution engine
  'types/api.ts',
  'types/todo.ts' // Keep if it exists
]

async function shouldDelete(path: string, relativePath: string): Promise<boolean> {
  // Check if path matches any protected pattern
  for (const pattern of PROTECTED_PATTERNS) {
    if (relativePath.includes(pattern)) {
      return false
    }
  }
  
  // Delete everything in apps/ directory (all user-created apps)
  if (relativePath.startsWith('apps/')) {
    return true
  }
  
  return false
}

async function deleteDirectory(dirPath: string): Promise<void> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      
      if (entry.isDirectory()) {
        await deleteDirectory(fullPath)
      } else {
        await unlink(fullPath)
      }
    }
    
    // Try to remove the directory itself (will fail if not empty or protected)
    try {
      await rmdir(dirPath)
    } catch {
      // Directory not empty or protected, that's OK
    }
  } catch (error) {
    // Directory doesn't exist or can't be accessed, that's OK
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { confirm } = body
    
    if (!confirm) {
      return NextResponse.json(
        { error: 'Confirmation required. Set confirm: true in request body.' },
        { status: 400 }
      )
    }
    
    const deleted: string[] = []
    const errors: string[] = []
    const scanDirs = await getScanDirectories()
    
    // Scan directories for files to delete (workspace/apps or project/apps)
    for (const dirPath of scanDirs) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name)
          const relativePath = `apps/${entry.name}`
          
          if (await shouldDelete(fullPath, relativePath)) {
            try {
              if (entry.isDirectory()) {
                await deleteDirectory(fullPath)
                deleted.push(relativePath + '/')
              } else {
                await unlink(fullPath)
                deleted.push(relativePath)
              }
            } catch (error) {
              const err = error as NodeJS.ErrnoException
              errors.push(`${relativePath}: ${err.message}`)
            }
          }
        }
      } catch (error) {
        // Directory doesn't exist, that's OK
        const err = error as NodeJS.ErrnoException
        if (err.code !== 'ENOENT') {
          errors.push(`${dirPath}: ${err.message}`)
        }
      }
    }
    
    return NextResponse.json({
      success: errors.length === 0,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
      message: `Deleted ${deleted.length} file(s)/directory(ies)`
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
