import { Agent } from './base'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../watcher'
import { VerificationService } from '../services/verification-service'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

const CONTROL_DIR = join(process.cwd(), 'control')
const PLAN_FILE = join(CONTROL_DIR, 'plan.md')
const RULES_FILE = join(CONTROL_DIR, 'rules.md')
const REPORT_FILE = join(CONTROL_DIR, 'report.md')
const INTENT_FILE = join(CONTROL_DIR, 'intent.md')

export class VerifyAgent extends Agent {
  private verificationService: VerificationService
  private watcher: StateWatcher

  constructor(
    context: any,
    fileService: any,
    gitService: any,
    llmService: any
  ) {
    super(context, fileService, gitService, llmService)
    this.verificationService = new VerificationService()
    this.watcher = new StateWatcher()
  }

  async onEnter(): Promise<void> {
    await this.log('Entering VERIFY state')
  }

  async execute(): Promise<void> {
    await this.log('Starting verification')

    // Read plan, rules, and intent
    const planContent = await readFile(PLAN_FILE, 'utf-8')
    const rules = await readFile(RULES_FILE, 'utf-8')
    const intent = await readFile(INTENT_FILE, 'utf-8')

    // Run verification checks
    const results = await this.verificationService.verifyAll({
      planContent,
      rules,
      intent
    })

    // Generate report
    const report = this.generateReport(results)
    await writeFile(REPORT_FILE, report, 'utf-8')
    await this.log('Verification report written')

    // Commit report
    await this.gitService.commit('Verification report', [REPORT_FILE])
    
    // Auto-push to remote if configured
    try {
      const remoteUrl = await this.gitService.getRemoteUrl('origin')
      if (remoteUrl) {
        await this.gitService.push('origin', 'main', false)
        await this.log('✅ Pushed verification report to origin/main')
      }
    } catch (error) {
      // Push failed, but don't fail verification - just log it
      await this.log(`⚠️ Auto-push failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Check if all verifications passed
    if (results.allPassed) {
      await this.log('All verifications passed, transitioning to DONE')
      await this.watcher.writeState('DONE')
    } else {
      // FAIL instead of PLAN to prevent infinite loop
      // User must manually investigate and restart
      await this.log('Verification failed, transitioning to FAIL')
      await this.log('Errors: ' + results.errors.join(', '))
      await this.watcher.writeState('FAIL')
    }
  }

  async onExit(): Promise<void> {
    await this.log('Exiting VERIFY state')
  }

  async validate(): Promise<boolean> {
    try {
      await readFile(PLAN_FILE, 'utf-8')
      await readFile(RULES_FILE, 'utf-8')
      return true
    } catch {
      return false
    }
  }

  private generateReport(results: {
    allPassed: boolean
    planComplete: boolean
    filesExist: boolean
    syntaxValid: boolean
    typesValid: boolean
    buildValid: boolean
    rulesCompliant: boolean
    successCriteria: boolean
    errors: string[]
    warnings: string[]
  }): string {
    let report = `# Verification Report\n\n`
    report += `Generated: ${new Date().toISOString()}\n\n`
    report += `## Overall Status\n\n`
    report += `${results.allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`

    report += `## Checks\n\n`
    report += `- Plan Complete: ${results.planComplete ? '✅' : '❌'}\n`
    report += `- Files Exist: ${results.filesExist ? '✅' : '❌'}\n`
    report += `- Syntax Valid: ${results.syntaxValid ? '✅' : '❌'}\n`
    report += `- Types Valid: ${results.typesValid ? '✅' : '❌'}\n`
    report += `- Build Valid: ${results.buildValid ? '✅' : '❌'}\n`
    report += `- Rules Compliant: ${results.rulesCompliant ? '✅' : '❌'}\n`
    report += `- Success Criteria: ${results.successCriteria ? '✅' : '❌'}\n\n`

    if (results.errors.length > 0) {
      report += `## Errors\n\n`
      for (const error of results.errors) {
        report += `- ${error}\n`
      }
      report += `\n`
    }

    if (results.warnings.length > 0) {
      report += `## Warnings\n\n`
      for (const warning of results.warnings) {
        report += `- ${warning}\n`
      }
      report += `\n`
    }

    return report
  }
}
