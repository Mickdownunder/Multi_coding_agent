import { Agent } from './base'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../watcher'
import { ContextOptimizer } from '../services/context-optimizer'
import { TokenBudgetService } from '../services/token-budget-service'
import { parseIntent } from '../services/intent-parser'
import { saveIntentSnapshot } from '../services/intent-snapshot'
import { Plan } from '../types/plan'

const CONTROL_DIR = join(process.cwd(), 'control')
const INTENT_FILE = join(CONTROL_DIR, 'intent.md')
const RULES_FILE = join(CONTROL_DIR, 'rules.md')
const PLAN_FILE = join(CONTROL_DIR, 'plan.md')

export class PlanAgent extends Agent {
  private contextOptimizer: ContextOptimizer
  private tokenBudget: TokenBudgetService
  private watcher: StateWatcher

  constructor(
    context: any,
    fileService: any,
    gitService: any,
    llmService: any
  ) {
    super(context, fileService, gitService, llmService)
    this.contextOptimizer = new ContextOptimizer()
    this.tokenBudget = new TokenBudgetService()
    this.watcher = new StateWatcher()
  }

  async onEnter(): Promise<void> {
    await this.log('Entering PLAN state')
  }

  async execute(): Promise<void> {
    await this.log('Starting plan generation')

    // Read and parse current intent (structured schema or fallback)
    const parsedIntent = await parseIntent()
    
    // Check if plan already exists and if it matches current intent
    let shouldRegenerate = true
    try {
      const existingPlan = await readFile(PLAN_FILE, 'utf-8')
      if (existingPlan && existingPlan.trim().length > 0) {
        // Check if plan contains the intent hash or key words from intent
        const intentKeywords = parsedIntent.body
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 4)
          .slice(0, 5)
        
        const planLower = existingPlan.toLowerCase()
        const matchesHash = existingPlan.includes(parsedIntent.hash)
        const matchesKeywords = intentKeywords.some(keyword => planLower.includes(keyword))
        
        if ((matchesHash || matchesKeywords) && existingPlan.length > 500) {
          // Plan seems to match - check if it's a valid plan structure
          if (existingPlan.includes('##') || existingPlan.includes('Phase') || existingPlan.includes('Step')) {
            await this.log('Plan exists and seems to match current intent, skipping generation')
            await this.watcher.writeState('IMPLEMENT')
            await this.log('Transitioned to IMPLEMENT state')
            return
          }
        }
        
        await this.log('Plan exists but does not match current intent, will regenerate')
        shouldRegenerate = true
      }
    } catch {
      // Plan doesn't exist, continue with generation
      shouldRegenerate = true
    }

    if (!shouldRegenerate) {
      return
    }

    // Read intent and rules
    const intent = await readFile(INTENT_FILE, 'utf-8')
    const rules = await readFile(RULES_FILE, 'utf-8')

    // Get parsed intent for requirements and hash
    const intentForPlan = await parseIntent(intent)

    // Get context
    const codebase = await this.context.getCodebase()

    // Generate plan using LLM
    await this.log('Calling LLM to generate plan...')
    let planResponse
    try {
      // HEARTBEAT: Wrapper für LLM-Call mit Heartbeat-Logging
      planResponse = await this.callWithHeartbeat(
        'Plan Generation',
        () => this.llmService.generatePlan({
          intent,
          rules,
          requirements: intentForPlan.requirements.length > 0 ? intentForPlan.requirements : undefined,
          context: {
            files: codebase.files.slice(0, 10), // Limit context
            structure: codebase.structure
          }
        })
      )
      await this.log('LLM plan generation completed')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      await this.log(`ERROR: LLM plan generation failed: ${errorMsg}`)
      throw new Error(`Failed to generate plan: ${errorMsg}`)
    }

    // Validate plan structure
    if (!planResponse || !planResponse.plan) {
      throw new Error('LLM returned invalid plan structure')
    }
    const plan = planResponse.plan as Plan

    // Extract app name from intent (use goal as base)
    const appName = this.extractAppName(intent)
    
    // Ensure metadata exists (LLM might not generate it)
    if (!plan.metadata) {
      plan.metadata = {
        generatedAt: new Date().toISOString(),
        intentHash: intentForPlan.hash,
        estimatedDuration: plan.phases.reduce((sum, p) => sum + p.steps.length * 5, 0),
        appName: appName
      }
    } else {
      plan.metadata.intentHash = plan.metadata.intentHash || intentForPlan.hash
      plan.metadata.appName = plan.metadata.appName || appName
    }

    // Estimate token usage
    const estimate = await this.tokenBudget.estimateProject(plan)
    await this.log(`Estimated tokens: ${estimate.estimatedTokens}, cost: $${estimate.estimatedCost.toFixed(2)}`)

    // Check budget
    const hasBudget = await this.tokenBudget.checkBudget()
    if (!hasBudget) {
      throw new Error('Token budget exceeded')
    }

    // Write plan.md
    const planMarkdown = this.planToMarkdown(plan)
    await writeFile(PLAN_FILE, planMarkdown, 'utf-8')
    await this.log('Plan written to plan.md')

    // Save intent snapshot for delta execution (B3)
    await saveIntentSnapshot(intentForPlan.hash, intentForPlan.requirements)

    // GIT-ISOLATION: Control files (plan.md) are NOT committed to workspace Git
    // They are system files in control-system/, not agent work products
    // Only generated app files in the workspace should be committed
    await this.log('ℹ️ Plan written to control/plan.md (system file, not committed to workspace Git)')
    
    // Check if remote exists, if not, try to create one automatically
    try {
      let remoteUrl = await this.gitService.getRemoteUrl('origin')
      
      if (!remoteUrl) {
        // No remote exists - try to create GitHub repo automatically
        await this.log('No Git remote found. Attempting to create GitHub repository...')
        remoteUrl = await this.tryAutoCreateGitHubRepo(plan.metadata.appName || appName)
      }
      
      // Auto-push to remote if configured
      if (remoteUrl) {
        try {
          await this.gitService.push('origin', 'main', false)
          await this.log('✅ Pushed plan to origin/main')
        } catch (error) {
          // Push failed, but don't fail plan generation - just log it
          await this.log(`⚠️ Auto-push failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else {
        await this.log('ℹ️ No Git remote configured. You can add one manually in the Files tab.')
      }
    } catch (error) {
      // Remote check/push failed, but don't fail plan generation - just log it
      await this.log(`WARNING: Git remote check failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Transition to IMPLEMENT
    await this.watcher.writeState('IMPLEMENT')
    await this.log('✅ Transitioned to IMPLEMENT state')
  }

  async onExit(): Promise<void> {
    await this.log('Exiting PLAN state')
  }

  async validate(): Promise<boolean> {
    // Check if intent.md exists
    try {
      await readFile(INTENT_FILE, 'utf-8')
      await readFile(RULES_FILE, 'utf-8')
      return true
    } catch {
      return false
    }
  }

  private extractAppName(intent: string): string {
    // Extract app name from intent goal
    // Look for patterns like "eine App", "eine ... App", "build a ...", etc.
    const goalMatch = intent.match(/## Goal\s*\n\s*(.+?)(?:\n|$)/i)
    if (goalMatch) {
      const goal = goalMatch[1].toLowerCase()
      
      // Try to extract app name
      // Examples: "eine Password Generator App" -> "password-generator"
      // "eine Todo-App" -> "todo-app"
      // "build a counter" -> "counter"
      const appMatch = goal.match(/(?:eine|build|create|make)\s+(?:.*?\s+)?(?:app|application)?\s*(?:für|for|called|named)?\s*([a-z0-9-]+(?:\s+[a-z0-9-]+)*)/i)
      if (appMatch) {
        return appMatch[1].trim().replace(/\s+/g, '-').toLowerCase()
      }
      
      // Fallback: use first few meaningful words
      const words = goal.split(/\s+/).filter(w => w.length > 3).slice(0, 2)
      if (words.length > 0) {
        return words.join('-').toLowerCase()
      }
    }
    
    // Default: use timestamp-based name
    return `app-${Date.now().toString(36)}`
  }

  /**
   * Try to automatically create a GitHub repository based on app name
   * Returns the repo URL if successful, null otherwise
   */
  private async tryAutoCreateGitHubRepo(appName: string): Promise<string | null> {
    try {
      // Check if GitHub token is available in environment or config
      const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
      
      if (!githubToken) {
        await this.log('ℹ️ No GitHub token found. Set GITHUB_TOKEN or GH_TOKEN environment variable for auto-repo creation.')
        return null
      }

      // Generate repo name from app name
      const repoName = this.sanitizeRepoName(appName)
      
      await this.log(`Creating GitHub repository: ${repoName}...`)

      // Create GitHub repository via API
      const repoData = {
        name: repoName,
        description: `Auto-generated repository for: ${appName}`,
        private: false,
        auto_init: false
      }

      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(repoData)
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        await this.log(`⚠️ Failed to create GitHub repo: ${errorData.message || 'Unknown error'}`)
        return null
      }

      const repo = await createResponse.json()
      const repoUrl = repo.clone_url

      // Add remote to local Git repository
      await this.gitService.addRemote('origin', repoUrl)
      await this.log(`✅ Created GitHub repository and added as 'origin' remote: ${repoUrl}`)

      return repoUrl
    } catch (error) {
      await this.log(`⚠️ Auto-create GitHub repo failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return null
    }
  }

  /**
   * Sanitize app name for use as GitHub repository name
   * GitHub repo names must be lowercase, alphanumeric, hyphens, underscores
   */
  private sanitizeRepoName(appName: string): string {
    return appName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100) // GitHub limit is 100 chars
  }

  private planToMarkdown(plan: Plan): string {
    let markdown = `# Plan\n\n`
    markdown += `Generated: ${plan.metadata.generatedAt}\n`
    markdown += `Estimated Duration: ${plan.metadata.estimatedDuration} minutes\n\n`

    for (const phase of plan.phases) {
      markdown += `## ${phase.name}\n\n`
      markdown += `${phase.description}\n\n`

      if (phase.dependencies.length > 0) {
        markdown += `**Dependencies:** ${phase.dependencies.join(', ')}\n\n`
      }

      markdown += `### Steps\n\n`
      for (const step of phase.steps) {
        markdown += `- [ ] ${step.id}: ${step.description}\n`
        if (step.files.length > 0) {
          markdown += `  - Files: ${step.files.join(', ')}\n`
        }
      }
      markdown += `\n`
    }

    return markdown
  }
}
