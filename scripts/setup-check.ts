#!/usr/bin/env node
/**
 * Setup and Health Check Script
 * Verifies all prerequisites for 100% functionality
 */

import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const CONTROL_DIR = join(process.cwd(), 'control')
const REQUIRED_FILES = ['state.txt', 'intent.md', 'rules.md', 'config.json']
const REQUIRED_DIRS = ['control']

interface CheckResult {
  name: string
  passed: boolean
  message: string
  fix?: string
}

const checks: CheckResult[] = []

// Check 1: Git repository
function checkGit(): CheckResult {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' })
    return { name: 'Git Repository', passed: true, message: 'Git repository initialized' }
  } catch {
    return {
      name: 'Git Repository',
      passed: false,
      message: 'Git repository not initialized',
      fix: 'Run: git init'
    }
  }
}

// Check 2: Control directory
function checkControlDir(): CheckResult {
  if (existsSync(CONTROL_DIR)) {
    return { name: 'Control Directory', passed: true, message: 'Control directory exists' }
  }
  return {
    name: 'Control Directory',
    passed: false,
    message: 'Control directory missing',
    fix: `Run: mkdir -p ${CONTROL_DIR}`
  }
}

// Check 3: Required files
function checkRequiredFiles(): CheckResult[] {
  const results: CheckResult[] = []
  
  for (const file of REQUIRED_FILES) {
    const filePath = join(CONTROL_DIR, file)
    if (existsSync(filePath)) {
      results.push({ name: `File: ${file}`, passed: true, message: `${file} exists` })
    } else {
      results.push({
        name: `File: ${file}`,
        passed: false,
        message: `${file} missing`,
        fix: `Create ${filePath}`
      })
    }
  }
  
  return results
}

// Check 4: API Key
function checkAPIKey(): CheckResult {
  try {
    const configPath = join(CONTROL_DIR, 'config.json')
    if (!existsSync(configPath)) {
      return {
        name: 'API Key',
        passed: false,
        message: 'config.json missing',
        fix: 'Create control/config.json with API key configuration'
      }
    }
    
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const apiKeyRef = config.llm?.apiKey
    
    if (!apiKeyRef) {
      return {
        name: 'API Key',
        passed: false,
        message: 'API key not configured in config.json',
        fix: 'Set llm.apiKey in control/config.json (use "env:OPENAI_API_KEY" format)'
      }
    }
    
    if (apiKeyRef.startsWith('env:')) {
      const envVar = apiKeyRef.substring(4)
      const value = process.env[envVar]
      if (!value) {
        return {
          name: 'API Key',
          passed: false,
          message: `Environment variable ${envVar} is not set`,
          fix: `Run: export ${envVar}="sk-..."`
        }
      }
      return { name: 'API Key', passed: true, message: `API key found in ${envVar}` }
    }
    
    if (apiKeyRef.startsWith('sk-')) {
      return { name: 'API Key', passed: true, message: 'API key configured (direct)' }
    }
    
    return {
      name: 'API Key',
      passed: false,
      message: 'API key format invalid',
      fix: 'Use "env:OPENAI_API_KEY" or direct key starting with "sk-"'
    }
  } catch (error) {
    return {
      name: 'API Key',
      passed: false,
      message: `Error checking API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fix: 'Check control/config.json format'
    }
  }
}

// Check 5: Node modules
function checkNodeModules(): CheckResult {
  if (existsSync(join(process.cwd(), 'node_modules'))) {
    return { name: 'Dependencies', passed: true, message: 'Node modules installed' }
  }
  return {
    name: 'Dependencies',
    passed: false,
    message: 'Node modules not installed',
    fix: 'Run: npm install'
  }
}

// Check 6: State file content
function checkStateFile(): CheckResult {
  const statePath = join(CONTROL_DIR, 'state.txt')
  if (!existsSync(statePath)) {
    return {
      name: 'State File',
      passed: false,
      message: 'state.txt missing',
      fix: 'Create control/state.txt with initial state (e.g., "PLAN")'
    }
  }
  
  try {
    const content = readFileSync(statePath, 'utf-8').trim()
    const validStates = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL']
    if (validStates.includes(content)) {
      return { name: 'State File', passed: true, message: `State file valid: ${content}` }
    }
    return {
      name: 'State File',
      passed: false,
      message: `Invalid state: ${content}`,
      fix: `Set state to one of: ${validStates.join(', ')}`
    }
  } catch (error) {
    return {
      name: 'State File',
      passed: false,
      message: `Error reading state.txt: ${error instanceof Error ? error.message : 'Unknown error'}`,
      fix: 'Check control/state.txt permissions'
    }
  }
}

// Run all checks
function runChecks(): void {
  console.log('🔍 Running setup checks...\n')
  
  checks.push(checkGit())
  checks.push(checkControlDir())
  checks.push(...checkRequiredFiles())
  checks.push(checkAPIKey())
  checks.push(checkNodeModules())
  checks.push(checkStateFile())
  
  let passed = 0
  let failed = 0
  
  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌'
    console.log(`${icon} ${check.name}: ${check.message}`)
    if (!check.passed && check.fix) {
      console.log(`   💡 Fix: ${check.fix}`)
    }
    if (check.passed) {
      passed++
    } else {
      failed++
    }
  }
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('\n🎉 All checks passed! System is ready for 100% functionality.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some checks failed. Please fix the issues above.')
    process.exit(1)
  }
}

// Auto-fix some issues
async function autoFix(): Promise<void> {
  console.log('🔧 Attempting auto-fix...\n')
  
  // Create control directory if missing
  if (!existsSync(CONTROL_DIR)) {
    mkdirSync(CONTROL_DIR, { recursive: true })
    console.log(`✅ Created ${CONTROL_DIR}`)
  }
  
  // Create state.txt if missing
  const statePath = join(CONTROL_DIR, 'state.txt')
  if (!existsSync(statePath)) {
    const { writeFileSync } = await import('fs')
    writeFileSync(statePath, 'PLAN\n', 'utf-8')
    console.log('✅ Created control/state.txt with initial state: PLAN')
  }
  
  // Create basic intent.md if missing
  const intentPath = join(CONTROL_DIR, 'intent.md')
  if (!existsSync(intentPath)) {
    const defaultIntent = `# Intent

## Goal
Describe your project goal here.

## Requirements
- Requirement 1
- Requirement 2

## Success Criteria
- Criterion 1
- Criterion 2
`
    const { writeFileSync } = await import('fs')
    writeFileSync(intentPath, defaultIntent, 'utf-8')
    console.log('✅ Created control/intent.md with template')
  }
  
  // Create basic rules.md if missing
  const rulesPath = join(CONTROL_DIR, 'rules.md')
  if (!existsSync(rulesPath)) {
    const defaultRules = `# Rules

## Invariants
- Rule 1
- Rule 2

## Forbidden Actions
- Action 1
- Action 2

## Definition of Done
- All tests pass
- Code follows style guide
`
    const { writeFileSync } = await import('fs')
    writeFileSync(rulesPath, defaultRules, 'utf-8')
    console.log('✅ Created control/rules.md with template')
  }
  
  console.log('\n✅ Auto-fix complete. Re-running checks...\n')
}

// Main
const args = process.argv.slice(2)

if (args.includes('--fix')) {
  autoFix().then(() => runChecks())
} else {
  runChecks()
}
