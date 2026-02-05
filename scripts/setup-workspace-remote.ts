#!/usr/bin/env node
/**
 * Script to manually set up the agent workspace remote
 * This is a one-time setup that connects agent-workspace to the Passwort-App repo
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import { resolve } from 'path'

const execAsync = promisify(exec)

const WORKSPACE_PATH = '/Users/michaellabitzke/agent-workspace'
const AGENT_REPO_URL = 'https://github.com/Mickdownunder/Passwort-App.git'

async function setupWorkspaceRemote() {
  try {
    console.log('🔧 Setting up agent workspace remote...')
    console.log(`Workspace: ${WORKSPACE_PATH}`)
    console.log(`Remote: ${AGENT_REPO_URL}`)

    // Check if workspace exists
    try {
      await execAsync(`test -d "${WORKSPACE_PATH}"`)
    } catch {
      console.log('📁 Creating workspace directory...')
      await execAsync(`mkdir -p "${WORKSPACE_PATH}"`)
    }

    // Check if Git is initialized
    let gitInitialized = false
    try {
      await execAsync('git rev-parse --git-dir', { cwd: WORKSPACE_PATH })
      gitInitialized = true
      console.log('✅ Git repository already initialized')
    } catch {
      console.log('📦 Initializing Git repository...')
      await execAsync('git init', { cwd: WORKSPACE_PATH })
      try {
        await execAsync('git branch -M main', { cwd: WORKSPACE_PATH })
      } catch {
        // Branch might already exist
      }
      gitInitialized = true
      console.log('✅ Git repository initialized')
    }

    // Check if remote exists
    try {
      const { stdout } = await execAsync('git remote get-url origin', { cwd: WORKSPACE_PATH })
      const existingUrl = stdout.trim()
      console.log(`📡 Existing remote: ${existingUrl}`)
      
      if (existingUrl === AGENT_REPO_URL) {
        console.log('✅ Remote already configured correctly!')
        return
      } else {
        console.log('🔄 Updating remote URL...')
        await execAsync(`git remote set-url origin ${AGENT_REPO_URL}`, { cwd: WORKSPACE_PATH })
        console.log('✅ Remote updated!')
      }
    } catch {
      // No remote exists
      console.log('➕ Adding remote...')
      await execAsync(`git remote add origin ${AGENT_REPO_URL}`, { cwd: WORKSPACE_PATH })
      console.log('✅ Remote added!')
    }

    // Verify remote
    const { stdout } = await execAsync('git remote -v', { cwd: WORKSPACE_PATH })
    console.log('\n📋 Current remotes:')
    console.log(stdout)

    console.log('\n✅ Workspace setup complete!')
    console.log(`\nThe agent will now push all commits to: ${AGENT_REPO_URL}`)
    console.log('Your main repo (control-system) remains untouched.')

  } catch (error) {
    console.error('❌ Error setting up workspace:', error)
    process.exit(1)
  }
}

setupWorkspaceRemote()
