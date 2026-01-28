import { NextRequest, NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

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
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json(
        { error: `${filename} not found` },
        { status: 404 }
      )
    }
    return NextResponse.json(
      { error: `Failed to read ${filename}` },
      { status: 500 }
    )
  }
}

// POST /api/files - Write a control file
export async function POST(request: NextRequest) {
  try {
    const { filename, content } = await request.json()
    
    if (!filename || !WRITABLE_FILES.includes(filename)) {
      return NextResponse.json(
        { error: `Cannot write to this file. Writable files: ${WRITABLE_FILES.join(', ')}` },
        { status: 400 }
      )
    }
    
    const filePath = join(CONTROL_DIR, filename)
    await writeFile(filePath, content, 'utf-8')
    return NextResponse.json({ filename, success: true })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to write file' },
      { status: 500 }
    )
  }
}
