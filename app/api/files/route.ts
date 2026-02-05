import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../../../execution/watcher'

const CONTROL_DIR = join(process.cwd(), 'control')

// Allowed files for reading
const READABLE_FILES = ['intent.md', 'rules.md', 'plan.md', 'report.md']
// Allowed files for writing
const WRITABLE_FILES = ['intent.md', 'rules.md']

// GET /api/files?name=intent.md - Read a control file
export async function GET(request: NextRequest) {
  const filename = request.nextUrl.searchParams.get('name')
  
  if (!filename || !READABLE_FILES.includes(filename)) {
    return NextResponse.json(
      { error: `Invalid file. Must be one of: ${READABLE_FILES.join(', ')}` },
      { status: 400 }
    )
  }
  
  try {
    const filePath = join(CONTROL_DIR, filename)
    const content = await readFile(filePath, 'utf-8')
    return NextResponse.json({ filename, content })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') {
      // For optional files (plan.md, report.md), return empty content instead of 404
      // This prevents terminal spam from polling
      if (filename === 'plan.md' || filename === 'report.md') {
        return NextResponse.json({ filename, content: '' })
      }
      return NextResponse.json(
        { error: `${filename} not found in /control directory` },
        { status: 404 }
      )
    }
    const errorMessage = err.message || 'Unknown error'
    return NextResponse.json(
      { error: `Failed to read ${filename}: ${errorMessage}` },
      { status: 500 }
    )
  }
}

const MAX_FILE_SIZE = 1024 * 1024 // 1MB

// POST /api/files - Write a control file
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filename, content } = body
    
    // Validate filename
    if (!filename || typeof filename !== 'string' || !WRITABLE_FILES.includes(filename)) {
      return NextResponse.json(
        { error: `Cannot write to this file. Writable files: ${WRITABLE_FILES.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Validate content
    if (content === undefined || content === null) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }
    
    if (typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content must be a string' },
        { status: 400 }
      )
    }
    
    // Validate file size
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024}KB` },
        { status: 400 }
      )
    }
    
    // Check for null bytes
    if (content.includes('\0')) {
      return NextResponse.json(
        { error: 'File contains invalid null bytes' },
        { status: 400 }
      )
    }
    
    const filePath = join(CONTROL_DIR, filename)
    await writeFile(filePath, content, 'utf-8')

    // B5 Intent-as-Orchestration: When intent.md is saved and state is DONE/FAIL, auto-transition to PLAN
    if (filename === 'intent.md') {
      try {
        const watcher = new StateWatcher()
        const currentState = await watcher.readState()
        if (currentState === 'DONE' || currentState === 'FAIL') {
          await watcher.writeState('PLAN')
          // Response can include hint for UI
        }
      } catch {
        // Non-fatal: state transition is best-effort
      }
    }

    return NextResponse.json({ filename, success: true })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to write file: ${errorMessage}` },
      { status: 500 }
    )
  }
}
