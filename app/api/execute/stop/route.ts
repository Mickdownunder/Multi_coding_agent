import { NextRequest, NextResponse } from 'next/server'
import { ExecutionEngine } from '../../../../execution/engine'
import { writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const CONTROL_DIR = join(process.cwd(), 'control')
const STATE_FILE = join(CONTROL_DIR, 'state.txt')
const LOCK_FILE = join(CONTROL_DIR, '.execution.lock')

let engine: ExecutionEngine | null = null

export async function POST(request: NextRequest) {
  try {
    // HARD-STOP: SIGKILL für alle Node-Prozesse die mit "execution" oder "engine" zu tun haben
    try {
      // Finde alle relevanten Prozesse
      const { stdout } = await execAsync('ps aux | grep -E "(node.*execution|node.*engine|next.*dev)" | grep -v grep | awk \'{print $2}\'')
      const pids = stdout.trim().split('\n').filter(pid => pid.length > 0)
      
      // Kill alle gefundenen Prozesse
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`)
        } catch {
          // Process might already be dead
        }
      }
    } catch {
      // No processes found or kill failed - continue
    }

    // HARD-STOP: Lösche alle .lock Dateien
    try {
      await unlink(LOCK_FILE)
    } catch {
      // Lock file might not exist
    }
    
    // Lösche auch andere mögliche Lock-Dateien
    try {
      const { readdir } = await import('fs/promises')
      const files = await readdir(CONTROL_DIR)
      for (const file of files) {
        if (file.includes('.lock') || file.includes('lock')) {
          try {
            await unlink(join(CONTROL_DIR, file))
          } catch {
            // Ignore errors
          }
        }
      }
    } catch {
      // Directory might not exist
    }

    // HARD-STOP: Setze state.txt sofort auf FAIL
    try {
      await writeFile(STATE_FILE, 'FAIL\n', 'utf-8')
    } catch {
      // Ignore write errors
    }

    // Stop engine if it exists
    if (engine) {
      try {
        await engine.stop()
      } catch {
        // Ignore stop errors
      }
      engine = null
    }

    return NextResponse.json({ 
      success: true, 
      message: 'HARD-STOP: Execution forcefully stopped. All locks cleared. State set to FAIL.' 
    })
  } catch (error) {
    // Even if something fails, try to set state to FAIL
    try {
      await writeFile(STATE_FILE, 'FAIL\n', 'utf-8')
    } catch {
      // Ignore
    }
    
    return NextResponse.json(
      { 
        success: true, // Return success even on error, as we've done hard stop
        message: 'HARD-STOP executed (some cleanup may have failed)',
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 200 }
    )
  }
}
