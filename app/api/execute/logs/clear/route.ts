import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const LOG_FILE = join(CONTROL_DIR, 'execution.log')

export async function POST() {
  try {
    // Clear the log file
    await writeFile(LOG_FILE, '', 'utf-8')
    return NextResponse.json({ success: true, message: 'Logs cleared' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
