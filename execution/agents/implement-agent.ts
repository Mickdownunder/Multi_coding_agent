import { Agent } from './base'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../watcher'
import { ContextOptimizer } from '../services/context-optimizer'
import { BatchGenerator } from '../services/batch-generator'
import { ModelSelector } from '../services/model-selector'
import { TokenBudgetService } from '../services/token-budget-service'
import { Plan, Step } from '../types/plan'

const CONTROL_DIR = join(process.cwd(), 'control')
const PLAN_FILE = join(CONTROL_DIR, 'plan.md')
const PROGRESS_FILE = join(CONTROL_DIR, 'progress.json')

export class ImplementAgent extends Agent {
  private contextOptimizer: ContextOptimizer
  private batchGenerator: BatchGenerator
  private modelSelector: ModelSelector
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
    this.batchGenerator = new BatchGenerator()
    this.modelSelector = new ModelSelector()
    this.tokenBudget = new TokenBudgetService()
    this.watcher = new StateWatcher()
  }

  async onEnter(): Promise<void> {
    await this.log('Entering IMPLEMENT state')
  }

  async execute(): Promise<void> {
    await this.log('Starting implementation')

    // Read plan
    const planContent = await readFile(PLAN_FILE, 'utf-8')
    const plan = this.parsePlan(planContent)
    
    // Get app name from plan metadata
    const appName = plan.metadata?.appName || 'app'
    const appDir = `apps/${appName}`
    await this.log(`App directory: ${appDir}`)

    // Load progress
    const progress = await this.loadProgress()

    // Get codebase context
    const codebase = await this.context.getCodebase()

    // Process each phase
    for (const phase of plan.phases) {
      await this.log(`Processing phase: ${phase.name}`)

      // Group steps for batch processing
      const incompleteSteps = phase.steps.filter(step => !progress.completedSteps.includes(step.id))
      const groups = await this.batchGenerator.groupSteps(incompleteSteps)

      // Process each group
      for (const group of groups) {
        await this.log(`Processing group: ${group.id} (${group.steps.length} steps)`)

        // Check questions before proceeding
        await this.checkQuestions()

        // Process steps in group
        for (const step of group.steps) {
          if (progress.completedSteps.includes(step.id)) {
            continue // Skip already completed steps
          }

          await this.log(`Executing step: ${step.id}`)

          try {
            // Select relevant files for context
            const relevantFiles = await this.contextOptimizer.selectRelevantFiles(step, codebase)
            const fileContents = await Promise.all(
              relevantFiles.map(async f => ({
                path: f.path,
                content: f.size > 50000 ? await this.contextOptimizer.summarizeFile(f) : f.content
              }))
            )

            // Generate code
            const codeResult = await this.llmService.generateCode({
              step: {
                id: step.id,
                description: step.description,
                type: step.type,
                files: step.files
              },
              context: {
                existingFiles: fileContents,
                projectStructure: codebase.structure,
                patterns: [],
                dependencies: []
              },
              constraints: {
                language: 'typescript',
                framework: 'nextjs',
                style: 'standard',
                rules: []
              }
            }) as { code: string; files: Array<{ path: string; content: string }>; explanation: string; dependencies: string[] }

            // Create/modify files
            const transaction = this.fileService.startTransaction()
            const filesToProcess = codeResult.files || (codeResult.code ? [{ path: step.files[0] || 'generated.ts', content: codeResult.code }] : [])
            for (const file of filesToProcess) {
              // Prepend app directory to file paths (unless it's already there or it's a system file)
              let filePath = file.path
              if (!filePath.startsWith('app/') && !filePath.startsWith('apps/') && 
                  !filePath.startsWith('components/') && !filePath.startsWith('lib/') &&
                  !filePath.startsWith('types/') && !filePath.startsWith('execution/') &&
                  !filePath.startsWith('control/')) {
                // Put in app directory
                filePath = `${appDir}/${filePath}`
              } else if (filePath.startsWith('app/') && !filePath.startsWith('apps/')) {
                // Convert app/... to apps/{appName}/...
                filePath = filePath.replace(/^app\//, `${appDir}/`)
              }
              
              if (step.type === 'create') {
                await transaction.addOperation({
                  type: 'create',
                  path: filePath,
                  content: file.content
                })
              } else if (step.type === 'modify') {
                await transaction.addOperation({
                  type: 'modify',
                  path: filePath,
                  content: file.content
                })
              }
            }

            // Commit transaction
            await this.fileService.commitTransaction()

            // Validate files
            for (const file of filesToProcess) {
              const validation = await this.fileService.validateOperation({
                type: step.type,
                path: file.path,
                content: file.content
              })
              if (!validation) {
                throw new Error(`Validation failed for ${file.path}`)
              }
            }

            // Commit to Git
            await this.gitService.commit(`Implement: ${step.description}`, filesToProcess.map(f => f.path))
            await this.log(`Committed: ${step.description}`)
            
            // Auto-push to remote if configured
            try {
              const remoteUrl = await this.gitService.getRemoteUrl('origin')
              if (remoteUrl) {
                await this.gitService.push('origin', 'main', false)
                await this.log(`✅ Pushed to origin/main`)
              }
            } catch (error) {
              // Push failed, but don't fail the step - just log it
              await this.log(`⚠️ Auto-push failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }

            // Mark step as complete
            progress.completedSteps.push(step.id)
            await this.saveProgress(progress)

            // Update plan.md
            await this.updatePlanStep(step.id, true)
          } catch (error) {
            await this.log(`Error executing step ${step.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            throw error
          }
        }
      }
    }

    // Check if all steps are complete
    const allSteps = plan.phases.flatMap(p => p.steps)
    const allComplete = allSteps.every(step => progress.completedSteps.includes(step.id))

    if (allComplete) {
      await this.log('All steps completed, transitioning to VERIFY')
      await this.watcher.writeState('VERIFY')
    }
  }

  async onExit(): Promise<void> {
    await this.log('Exiting IMPLEMENT state')
  }

  async validate(): Promise<boolean> {
    try {
      await readFile(PLAN_FILE, 'utf-8')
      return true
    } catch {
      return false
    }
  }

  private parsePlan(content: string): Plan {
    // Simple parser - in production, use a proper markdown parser
    const phases: Array<{ name: string; description: string; steps: Step[]; dependencies: string[] }> = []
    const lines = content.split('\n')
    
    let currentPhase: { name: string; description: string; steps: Step[]; dependencies: string[] } | null = null
    let stepCounter = 0

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentPhase) {
          phases.push(currentPhase)
        }
        currentPhase = {
          name: line.substring(3).trim(),
          description: '',
          steps: [],
          dependencies: []
        }
      } else if (line.startsWith('- [ ]') && currentPhase) {
        const match = line.match(/- \[ \] (.+?): (.+)/)
        if (match) {
          stepCounter++
          currentPhase.steps.push({
            id: match[1].trim(),
            description: match[2].trim(),
            type: 'create',
            files: [],
            estimatedTime: 5
          })
        }
      }
    }

    if (currentPhase) {
      phases.push(currentPhase)
    }

    return {
      phases,
      metadata: {
        generatedAt: new Date().toISOString(),
        intentHash: '',
        estimatedDuration: phases.reduce((sum, p) => sum + p.steps.length * 5, 0)
      }
    }
  }

  private async loadProgress(): Promise<{ completedSteps: string[] }> {
    try {
      const content = await readFile(PROGRESS_FILE, 'utf-8')
      return JSON.parse(content)
    } catch {
      return { completedSteps: [] }
    }
  }

  private async saveProgress(progress: { completedSteps: string[] }): Promise<void> {
    await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2), 'utf-8')
  }

  private async updatePlanStep(stepId: string, completed: boolean): Promise<void> {
    const content = await readFile(PLAN_FILE, 'utf-8')
    const updated = content.replace(
      new RegExp(`- \\[ \\] ${stepId}:`, 'g'),
      `- [${completed ? 'x' : ' '}] ${stepId}:`
    )
    await writeFile(PLAN_FILE, updated, 'utf-8')
  }
}
