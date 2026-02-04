import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST() {
  try {
    // Check if already initialized
    try {
      await execAsync('git rev-parse --git-dir')
      return NextResponse.json({
        success: true,
        alreadyInitialized: true,
        message: 'Git repository was already initialized',
        path: '.git'
      })
    } catch {
      // Not initialized, initialize it
    }

    // Initialize Git repository
    await execAsync('git init')
    
    // Try to set default branch to main
    try {
      await execAsync('git branch -M main')
    } catch {
      // Branch command might not be available, that's okay
    }

    return NextResponse.json({
      success: true,
      alreadyInitialized: false,
      message: 'Git repository initialized successfully',
      path: '.git'
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: 'Make sure Git is installed and accessible'
      },
      { status: 500 }
    )
  }
}
