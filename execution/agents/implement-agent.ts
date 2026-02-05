import { Agent } from './base'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { StateWatcher } from '../watcher'
import { ContextOptimizer } from '../services/context-optimizer'
import { BatchGenerator } from '../services/batch-generator'
import { ModelSelector } from '../services/model-selector'
import { TokenBudgetService } from '../services/token-budget-service'
import { prependTraceabilityHeader, mergeStepTraceability } from '../services/traceability-service'
import { parseIntent, computeIntentDelta } from '../services/intent-parser'
import { loadIntentSnapshot } from '../services/intent-snapshot'
import { Plan, Step } from '../types/plan'

const TRACEABILITY_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']

const CONTROL_DIR = join(process.cwd(), 'control')
const PLAN_FILE = join(CONTROL_DIR, 'plan.md')
const PROGRESS_FILE = join(CONTROL_DIR, 'progress.json')

export class ImplementAgent extends Agent {
  private contextOptimizer: ContextOptimizer
  private batchGenerator: BatchGenerator
  private modelSelector: ModelSelector
  private tokenBudget: TokenBudgetService
  private watcher: StateWatcher
  private policyViolationCount: Map<string, number> = new Map() // Track policy violations per step
  private skippedSteps: Set<string> = new Set() // Track skipped steps

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

    // Intent delta: compute which requirements changed (for incremental execution)
    let unchangedReqIds = new Set<string>()
    const snapshot = await loadIntentSnapshot()
    const currentIntent = await parseIntent()
    if (snapshot && currentIntent.hash !== snapshot.intentHash) {
      const delta = computeIntentDelta(
        { requirements: snapshot.requirements, body: '', hash: snapshot.intentHash, hasStructuredSchema: false },
        currentIntent
      )
      const affectedIds = new Set([...delta.added, ...delta.changed, ...delta.removed])
      unchangedReqIds = new Set(
        snapshot.requirements.map(r => r.id).filter(id => !affectedIds.has(id))
      )
      await this.log(`Intent delta: ${delta.added.length} added, ${delta.removed.length} removed, ${delta.changed.length} changed. Unchanged: ${unchangedReqIds.size}`)
    }
    
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
          // CHECKPOINTING: Skip already completed steps (resume from progress.json)
          if (progress.completedSteps.includes(step.id)) {
            await this.log(`Skipping already completed step: ${step.id}`)
            continue
          }

          // Intent-Delta: Skip steps that only touch unchanged requirements
          if (unchangedReqIds.size > 0 && step.requirementIds && step.requirementIds.length > 0) {
            const allUnchanged = step.requirementIds.every(id => unchangedReqIds.has(id))
            if (allUnchanged) {
              await this.log(`Skipping step ${step.id} (requirements unchanged: ${step.requirementIds.join(', ')})`)
              progress.completedSteps.push(step.id)
              await this.saveProgress(progress)
              await this.updatePlanStep(step.id, true)
              continue
            }
          }
          
          // FEHLER-ISOLATION: Retry failed steps (remove from failedSteps to retry)
          if (progress.failedSteps && progress.failedSteps.includes(step.id)) {
            await this.log(`Retrying previously failed step: ${step.id}`)
            // Remove from failedSteps to allow retry
            progress.failedSteps = progress.failedSteps.filter(id => id !== step.id)
            await this.saveProgress(progress)
          }

          await this.log(`Executing step: ${step.id}`)

          let filesToProcess: Array<{ path: string; content: string }> = []
          let fileContents: Array<{ path: string; content: string }> = []
          let retryCount = 0
          let shouldRetry = false
          try {
            // Select relevant files for context
            const relevantFiles = await this.contextOptimizer.selectRelevantFiles(step, codebase)
            fileContents = await Promise.all(
              relevantFiles.map(async f => ({
                path: f.path,
                content: f.size > 50000 ? await this.contextOptimizer.summarizeFile(f) : f.content
              }))
            )

            // HEARTBEAT: Generate code with heartbeat logging
            let codeResult = await this.callWithHeartbeat(
              `Code Generation: ${step.id}`,
              () => this.llmService.generateCode({
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
              })
            ) as { code: string; files: Array<{ path: string; content: string }>; explanation: string; dependencies: string[] }

            // Create/modify files
            filesToProcess = codeResult.files || (codeResult.code ? [{ path: step.files[0] || 'generated.ts', content: codeResult.code }] : [])
            const requirementIds = step.requirementIds || []
            
            // AUTO-CORRECTION LOOP: Versuche Dateien zu erstellen, bei Policy Violation → Auto-Correction
            const maxRetries = 2 // Max 2 Auto-Correction Versuche
            
            do {
              shouldRetry = false
              const transaction = this.fileService.startTransaction()
              
              try {
                // Process files
                for (const file of filesToProcess) {
              // PFAD-PRÄZISION: All Next.js app files must be in apps/{appName}/ within workspace
              let filePath = file.path
              
              // PFAD-CHECK: Blockiere System-Ordner endgültig (execution/, control-system/, control/)
              if (filePath.includes('control-system') || 
                  filePath.includes('/control/') || 
                  filePath.startsWith('control/') ||
                  filePath.includes('execution/') ||
                  filePath.startsWith('execution/') ||
                  filePath.includes('/execution/')) {
                throw new Error(`FORBIDDEN: Cannot write to system directory. File path: ${filePath} must be in apps/${appName}/ within workspace.`)
              }
              
              // Normalize paths: ensure all app files go to apps/{appName}/
              if (filePath.startsWith('apps/')) {
                // Already in apps/, but ensure it's apps/{appName}/
                if (!filePath.startsWith(`apps/${appName}/`)) {
                  // Extract path after apps/
                  const afterApps = filePath.replace(/^apps\//, '')
                  filePath = `${appDir}/${afterApps}`
                } else {
                  // Already correct: apps/{appName}/...
                  // Keep as is (will be resolved relative to workspace)
                }
              } else if (filePath.startsWith('app/')) {
                // Convert app/... to apps/{appName}/...
                filePath = filePath.replace(/^app\//, `${appDir}/`)
              } else if (!filePath.startsWith('components/') && 
                         !filePath.startsWith('lib/') &&
                         !filePath.startsWith('types/') &&
                         !filePath.startsWith('execution/')) {
                // Default: put in apps/{appName}/
                filePath = `${appDir}/${filePath}`
              }
              // Note: components/, lib/, types/ are kept as-is (they'll be resolved relative to workspace)
              
              // Prepend traceability header for code files
              let content = file.content
              const ext = filePath.match(/\.[^.]+$/)?.[0] || ''
              if (TRACEABILITY_EXTENSIONS.includes(ext)) {
                content = prependTraceabilityHeader(content, step.id, requirementIds)
              }

              if (step.type === 'create') {
                await transaction.addOperation({
                  type: 'create',
                  path: filePath,
                  content
                })
              } else if (step.type === 'modify') {
                await transaction.addOperation({
                  type: 'modify',
                  path: filePath,
                  content
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
                
                // Success - break out of retry loop
                break
              } catch (error) {
                // Rollback transaction on error
                try {
                  await this.fileService.rollbackTransaction()
                } catch {
                  // Ignore rollback errors
                }
                
                // Check if it's a Policy Violation that we can auto-correct
                if (error instanceof Error && error.name === 'PolicyViolationError') {
                  const policyError = error as any
                  
                  // AUTO-CORRECTION: Bei 'any'-Typ → automatische Korrektur
                  if ((policyError.violationType === 'forbidden-type' || 
                       (policyError.violations?.some((v: string) => v.includes('any')) || 
                        error.message.includes('any'))) && 
                      retryCount < maxRetries) {
                    
                    await this.log(`🔧 AUTO-CORRECTION (${retryCount + 1}/${maxRetries}): Attempting to fix 'any' type violation...`)
                    
                    try {
                      // Finde die betroffene Datei
                      const problematicFile = filesToProcess.find(f => 
                        policyError.filePath?.includes(f.path) || 
                        f.path.includes(policyError.filePath || '')
                      ) || filesToProcess[0]
                      
                      // Rufe LLM für Korrektur auf
                      const correctedResult = await this.callWithHeartbeat(
                        `Auto-Correction: Fix 'any' types`,
                        () => this.llmService.generateCode({
                          step: {
                            id: `${step.id}-fix-${retryCount}`,
                            description: `Fix 'any' types: ${step.description}`,
                            type: 'modify',
                            files: [problematicFile.path]
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
                            rules: ['NO_ANY_TYPES', 'STRICT_TYPESCRIPT']
                          }
                        })
                      ) as { code: string; files: Array<{ path: string; content: string }>; explanation: string; dependencies: string[] }
                      
                      // Ersetze Code in filesToProcess
                      const correctedFile = correctedResult.files?.[0] || { path: problematicFile.path, content: correctedResult.code }
                      const fileIndex = filesToProcess.findIndex(f => f.path === problematicFile.path)
                      if (fileIndex >= 0) {
                        filesToProcess[fileIndex] = correctedFile
                        await this.log(`✅ AUTO-CORRECTION: Code corrected, retrying...`)
                        retryCount++
                        shouldRetry = true
                        continue // Retry with corrected code
                      }
                    } catch (correctionError) {
                      await this.log(`⚠️ AUTO-CORRECTION FAILED: ${correctionError instanceof Error ? correctionError.message : String(correctionError)}`)
                      // Fall through to normal error handling
                    }
                  }
                }
                
                // If we can't auto-correct or max retries reached, throw error
                throw error
              }
            } while (shouldRetry && retryCount < maxRetries)

            // Commit to Git (only workspace files, not control-system files!)
            try {
              // Get actual file paths from transaction (after workspace resolution)
              // These paths are relative to workspace (apps/{appName}/...)
              const actualFilePaths = filesToProcess.map(f => {
                // Use the normalized path that was written
                let finalPath = f.path
                if (!finalPath.startsWith('apps/')) {
                  finalPath = `${appDir}/${finalPath}`
                }
                return finalPath
              })
              
              const commitResult = await this.gitService.commit(`Implement: ${step.description}`, actualFilePaths)
              
              // GRACEFUL COMMIT: "no-changes" or missing files are warnings, not errors
              if (commitResult === 'no-changes') {
                await this.log(`ℹ️ No changes to commit for: ${step.description} (files may not exist or unchanged)`)
                // Continue execution - this is not a failure
              } else {
                await this.log(`Committed: ${step.description} (${commitResult})`)
              }
              
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
            } catch (error) {
              // GRACEFUL COMMIT: Only log warning, don't fail execution
              const errorMsg = error instanceof Error ? error.message : String(error)
              // Check if it's a "file not found" or "no changes" error - these are OK
              if (errorMsg.includes('pathspec') || 
                  errorMsg.includes('did not match any files') ||
                  errorMsg.includes('nothing to commit') ||
                  errorMsg.includes('no changes')) {
                await this.log(`ℹ️ Git commit skipped: ${errorMsg}`)
              } else {
                // Real error - log warning but continue
                await this.log(`WARNING: Git commit failed: ${errorMsg}`)
              }
              // Don't throw - continue execution
            }

            // Mark step as complete
            progress.completedSteps.push(step.id)
            await this.saveProgress(progress)

            // Record traceability (REQ -> files mapping)
            const intentHash = plan.metadata?.intentHash || ''
            const writtenPaths = filesToProcess.map(f => {
              let p = f.path
              if (!p.startsWith('apps/')) p = `${appDir}/${p}`
              return p
            })
            await mergeStepTraceability(intentHash, writtenPaths.map(path => ({ path })), step.id, requirementIds)

            // Update plan.md
            await this.updatePlanStep(step.id, true)
          } catch (error) {
            if (error instanceof Error && error.name === 'PolicyViolationError') {
              const policyError = error as any
              await this.log(`POLICY VIOLATION in step ${step.id}: ${error.message}`)
              
              if (policyError.filePath) {
                await this.log(`  File: ${policyError.filePath}`)
              }
              
              if (policyError.violationType) {
                await this.log(`  Violation Type: ${policyError.violationType}`)
              }
              
              if ('violations' in policyError && Array.isArray(policyError.violations)) {
                await this.log(`  Violations:`)
                for (const violation of policyError.violations) {
                  await this.log(`    - ${violation}`)
                }
              }
              
              if (policyError.suggestedFix) {
                await this.log(`  Suggested Fix: ${policyError.suggestedFix}`)
              }
              
              // Create structured error message for LLM context
              const structuredError = {
                type: 'PolicyViolationError',
                stepId: step.id,
                filePath: policyError.filePath,
                violationType: policyError.violationType,
                violations: policyError.violations || [],
                suggestedFix: policyError.suggestedFix
              }
              
              await this.log(`  Structured Error: ${JSON.stringify(structuredError, null, 2)}`)
              
              // AUTO-CORRECTION: Versuche automatische Korrektur für bestimmte Violation-Typen
              const violationKey = `${step.id}:${policyError.violationType || 'unknown'}`
              const violationCount = (this.policyViolationCount.get(violationKey) || 0) + 1
              this.policyViolationCount.set(violationKey, violationCount)
              
              // AUTO-CORRECTION: Bei 'any'-Typ oder 'forbidden-type' → automatische Korrektur
              if ((policyError.violationType === 'forbidden-type' || 
                   policyError.violationType === 'unknown' && 
                   (policyError.violations?.some((v: string) => v.includes('any')) || 
                    error.message.includes('any')))) {
                
                await this.log(`🔧 AUTO-CORRECTION: Attempting to fix 'any' type violation in step ${step.id}...`)
                
                try {
                  // Lese den fehlerhaften Code
                  let problematicCode = ''
                  const problematicFile = filesToProcess.find(f =>
                    policyError.filePath?.includes(f.path) || f.path.includes(policyError.filePath || '')
                  )
                  if (policyError.filePath) {
                    try {
                      problematicCode = await this.fileService.readFile(policyError.filePath)
                    } catch {
                      problematicCode = problematicFile?.content || ''
                    }
                  } else {
                    problematicCode = problematicFile?.content || ''
                  }
                  
                  // Erstelle Korrektur-Prompt für LLM
                  const correctionPrompt = `You are fixing a TypeScript code that contains forbidden 'any' types. 
Replace ALL 'any' types with proper TypeScript types (use 'unknown', specific types, or interfaces).
Do NOT use 'any' anywhere in the code.

Original code with error:
\`\`\`typescript
${problematicCode}
\`\`\`

Error details:
${policyError.violations?.join('\n') || error.message}

Fix: Replace all 'any' types with proper TypeScript types. Return ONLY the corrected code, no explanations.`
                  
                  // Rufe LLM für Korrektur auf
                  await this.log(`  Calling LLM to fix 'any' types...`)
                  const correctedCodeResult = await this.callWithHeartbeat(
                    `Auto-Correction: Fix 'any' types in ${step.id}`,
                    () => this.llmService.generateCode({
                      step: {
                        id: `${step.id}-fix`,
                        description: `Fix 'any' types in ${step.description}`,
                        type: 'modify',
                        files: [policyError.filePath || problematicFile?.path || '']
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
                        rules: ['NO_ANY_TYPES', 'STRICT_TYPESCRIPT']
                      }
                    })
                  ) as { code: string; files: Array<{ path: string; content: string }>; explanation: string; dependencies: string[] }
                  
                  // Verwende korrigierten Code
                  const correctedFile = correctedCodeResult.files?.[0] || { path: problematicFile?.path || '', content: correctedCodeResult.code }
                  
                  // Validiere korrigierten Code erneut
                  await this.log(`  Validating corrected code...`)
                  const validation = await this.fileService.validateOperation({
                    type: step.type,
                    path: correctedFile.path,
                    content: correctedFile.content
                  })
                  
                  if (validation) {
                    // Korrektur erfolgreich - verwende korrigierten Code
                    await this.log(`✅ AUTO-CORRECTION SUCCESS: Fixed 'any' types in step ${step.id}`)
                    
                    // Ersetze in filesToProcess
                    const idx = filesToProcess.findIndex(f => f.path === problematicFile?.path || policyError.filePath)
                    if (idx >= 0) {
                      filesToProcess[idx] = correctedFile
                    } else {
                      filesToProcess = [correctedFile]
                    }
                    
                    // Reset violation count für diesen Step
                    this.policyViolationCount.delete(violationKey)
                    
                    // Retry mit korrigiertem Code
                    retryCount++
                    shouldRetry = true
                    continue
                  } else {
                    await this.log(`⚠️ AUTO-CORRECTION: Corrected code still has validation errors`)
                    // Fall through zu normaler Fehlerbehandlung
                  }
                } catch (correctionError) {
                  await this.log(`⚠️ AUTO-CORRECTION FAILED: ${correctionError instanceof Error ? correctionError.message : String(correctionError)}`)
                  // Fall through zu normaler Fehlerbehandlung
                }
              }
              
              // POLICY-LIMIT: Prüfe ob gleiche Violation 3x aufgetreten ist
              if (violationCount >= 3) {
                // POLICY-LIMIT: 3x gleiche Violation → Prozess anhalten
                await this.log(`🚨 POLICY-LIMIT ERREICHT: Step ${step.id} hat 3x die gleiche Policy Violation (${policyError.violationType}). Prozess wird angehalten.`)
                await this.log(`   Bitte manuell beheben: ${policyError.suggestedFix || 'Review policy violations'}`)
                await this.watcher.writeState('FAIL')
                throw new Error(`Policy violation limit reached for step ${step.id}. Manual intervention required.`)
              }
              
              // FEHLER-ISOLATION: Mark step as failed, but don't fail entire execution
              if (!progress.failedSteps) {
                progress.failedSteps = []
              }
              if (!progress.failedSteps.includes(step.id)) {
                progress.failedSteps.push(step.id)
                await this.saveProgress(progress)
              }
              
              await this.log(`Step ${step.id} marked as FAILED (${violationCount}/3). Fix the code and retry this step.`)
              // Continue to next step instead of throwing
              continue
            }
            
            // FEHLER-ISOLATION: Mark step as failed for other errors too
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            await this.log(`Error executing step ${step.id}: ${errorMsg}`)
            
            // STEP-SKIPPING: Prüfe ob "fetch failed" oder andere wiederholte Fehler
            const isFetchError = errorMsg.includes('fetch failed') || errorMsg.includes('Failed to fetch') || errorMsg.includes('network')
            const errorKey = `${step.id}:${isFetchError ? 'fetch-failed' : 'other-error'}`
            const errorCount = (this.policyViolationCount.get(errorKey) || 0) + 1
            this.policyViolationCount.set(errorKey, errorCount)
            
            // STEP-SKIPPING: Bei 3x fetch failed oder anderen wiederholten Fehlern → Skip
            if (errorCount >= 3) {
              await this.log(`⏭️ STEP-SKIPPING: Step ${step.id} hat 3x den gleichen Fehler (${errorMsg.substring(0, 50)}...). Markiere als SKIPPED und fahre mit nächster Phase fort.`)
              this.skippedSteps.add(step.id)
              
              // Entferne aus failedSteps und füge zu completedSteps hinzu (als skipped)
              if (!progress.failedSteps) {
                progress.failedSteps = []
              }
              progress.failedSteps = progress.failedSteps.filter(id => id !== step.id)
              
              // Markiere als completed (aber skipped)
              if (!progress.completedSteps.includes(step.id)) {
                progress.completedSteps.push(step.id)
              }
              
              await this.saveProgress(progress)
              await this.log(`Step ${step.id} marked as SKIPPED. Continuing with next step.`)
              // Continue to next step instead of throwing
              continue
            }
            
            if (!progress.failedSteps) {
              progress.failedSteps = []
            }
            if (!progress.failedSteps.includes(step.id)) {
              progress.failedSteps.push(step.id)
              await this.saveProgress(progress)
            }
            
            await this.log(`Step ${step.id} marked as FAILED (${errorCount}/3). Will retry on next execution.`)
            // Continue to next step instead of throwing
            continue
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

  private async loadProgress(): Promise<{ completedSteps: string[]; failedSteps: string[] }> {
    try {
      const content = await readFile(PROGRESS_FILE, 'utf-8')
      const parsed = JSON.parse(content)
      // Ensure backward compatibility
      return {
        completedSteps: parsed.completedSteps || [],
        failedSteps: parsed.failedSteps || []
      }
    } catch {
      return { completedSteps: [], failedSteps: [] }
    }
  }

  private async saveProgress(progress: { completedSteps: string[]; failedSteps?: string[] }): Promise<void> {
    await writeFile(PROGRESS_FILE, JSON.stringify({
      completedSteps: progress.completedSteps,
      failedSteps: progress.failedSteps || []
    }, null, 2), 'utf-8')
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
