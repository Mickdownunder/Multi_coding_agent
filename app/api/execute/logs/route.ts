import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const LOG_FILE = join(CONTROL_DIR, 'execution.log')
const LOG_FILE_ALT = join(CONTROL_DIR, 'logs', 'execution.log')

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lines = parseInt(searchParams.get('lines') || '100', 10) // Last N lines
    
    // Try main log file first, then logs subdirectory
    let logContent = ''
    try {
      logContent = await readFile(LOG_FILE, 'utf-8')
    } catch {
      try {
        logContent = await readFile(LOG_FILE_ALT, 'utf-8')
      } catch {
        // Log file doesn't exist yet
        return NextResponse.json({
          logs: [],
          totalLines: 0
        })
      }
    }

    // Split into lines and get last N lines
    const allLines = logContent.split('\n').filter(line => line.trim().length > 0)
    const lastLines = allLines.slice(-lines)
    
    // Parse log entries
    const logs = lastLines.map((line, index) => {
      // Format: [timestamp] [LEVEL] message
      const match = line.match(/^\[([^\]]+)\] \[([^\]]+)\] (.+)$/)
      if (match) {
        return {
          timestamp: match[1],
          level: match[2],
          message: match[3],
          raw: line
        }
      }
      // Fallback for lines that don't match format
      return {
        timestamp: new Date().toISOString(),
        level: 'INFO',
        message: line,
        raw: line
      }
    })

    return NextResponse.json({
      logs,
      totalLines: allLines.length
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
