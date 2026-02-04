import { Agent } from './base'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../watcher'
import { ContextOptimizer } from '../services/context-optimizer'
import { TokenBudgetService } from '../services/token-budget-service'
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

    // Read current intent
    const currentIntent = await readFile(INTENT_FILE, 'utf-8')
    
    // Create a simple hash of the intent (first 100 chars of goal section)
    const intentHash = currentIntent
      .split('\n')
      .slice(0, 10)
      .join(' ')
      .substring(0, 100)
      .replace(/\s+/g, ' ')
      .trim()
    
    // Check if plan already exists and if it matches current intent
    let shouldRegenerate = true
    try {
      const existingPlan = await readFile(PLAN_FILE, 'utf-8')
      if (existingPlan && existingPlan.trim().length > 0) {
        // Check if plan contains the intent hash or key words from intent
        const intentKeywords = currentIntent
          .toLowerCase()
          .split(/\s+/)
          .filter(word => word.length > 4)
          .slice(0, 5)
        
        const planLower = existingPlan.toLowerCase()
        const matchesKeywords = intentKeywords.some(keyword => planLower.includes(keyword))
        
        if (matchesKeywords && existingPlan.length > 500) {
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

    // Get context
    const codebase = await this.context.getCodebase()

    // Generate plan using LLM
    await this.log('Calling LLM to generate plan...')
    let planResponse
    try {
      planResponse = await this.llmService.generatePlan({
        intent,
        rules,
        context: {
          files: codebase.files.slice(0, 10), // Limit context
          structure: codebase.structure
        }
      })
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
        intentHash: intentHash.substring(0, 50),
        estimatedDuration: plan.phases.reduce((sum, p) => sum + p.steps.length * 5, 0),
        appName: appName
      }
    } else {
      // Ensure appName is set
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

    // Commit to Git
    try {
      await this.gitService.commit('Generate plan from intent', [PLAN_FILE])
      await this.log('Plan committed to Git')
      
      // Auto-push to remote if configured
      try {
        const remoteUrl = await this.gitService.getRemoteUrl('origin')
        if (remoteUrl) {
          await this.gitService.push('origin', 'main', false)
          await this.log('✅ Pushed plan to origin/main')
        }
      } catch (error) {
        // Push failed, but don't fail plan generation - just log it
        await this.log(`⚠️ Auto-push failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    } catch (error) {
      await this.log(`WARNING: Git commit failed: ${error instanceof Error ? error.message : String(error)}`)
      // Don't fail execution if git commit fails
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
