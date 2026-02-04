import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    // Return the current working directory (project root)
    const projectPath = process.cwd()
    
    return NextResponse.json({
      path: projectPath,
      relative: projectPath
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
