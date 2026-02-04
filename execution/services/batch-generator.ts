import { Step, GeneratedCode, ValidationResult } from '../types/plan'

export interface StepGroup {
  id: string
  steps: Step[]
  commonContext: string[]
  estimatedTokens: number
}

export class BatchGenerator {
  async groupSteps(steps: Step[]): Promise<StepGroup[]> {
    const groups: StepGroup[] = []
    const processed = new Set<string>()

    for (const step of steps) {
      if (processed.has(step.id)) {
        continue
      }

      // Find related steps (same type, similar files)
      const related = steps.filter(s => 
        !processed.has(s.id) &&
        s.type === step.type &&
        this.hasCommonFiles(step, s)
      )

      // Group up to 5 related steps
      const groupSteps = [step, ...related.slice(0, 4)]
      groupSteps.forEach(s => processed.add(s.id))

      const commonContext = this.findCommonContext(groupSteps)
      const estimatedTokens = this.estimateTokens(groupSteps, commonContext)

      groups.push({
        id: `group-${groups.length}`,
        steps: groupSteps,
        commonContext,
        estimatedTokens
      })
    }

    return groups
  }

  private hasCommonFiles(step1: Step, step2: Step): boolean {
    const files1 = new Set(step1.files || [])
    const files2 = new Set(step2.files || [])
    
    for (const file of Array.from(files1)) {
      if (files2.has(file)) {
        return true
      }
    }
    return false
  }

  private findCommonContext(steps: Step[]): string[] {
    if (steps.length === 0) {
      return []
    }

    const allFiles = new Set<string>()
    steps.forEach(step => {
      (step.files || []).forEach(file => allFiles.add(file))
    })

    // Files that appear in multiple steps are common context
    const fileCounts = new Map<string, number>()
    steps.forEach(step => {
      (step.files || []).forEach(file => {
        fileCounts.set(file, (fileCounts.get(file) || 0) + 1)
      })
    })

    const commonFiles: string[] = []
    fileCounts.forEach((count, file) => {
      if (count > 1) {
        commonFiles.push(file)
      }
    })

    return commonFiles
  }

  private estimateTokens(steps: Step[], commonContext: string[]): number {
    // Base tokens per step
    const baseTokensPerStep = 500
    
    // Common context tokens (counted once)
    const commonContextTokens = commonContext.length * 200
    
    // Unique file tokens per step
    const uniqueFilesPerStep = steps.reduce((sum, step) => {
      const unique = (step.files || []).filter(f => !commonContext.includes(f))
      return sum + unique.length
    }, 0)
    const uniqueFileTokens = uniqueFilesPerStep * 300
    
    // Output tokens (estimated code size)
    const outputTokens = steps.length * 1000

    return baseTokensPerStep * steps.length + commonContextTokens + uniqueFileTokens + outputTokens
  }

  async generateBatch(group: StepGroup): Promise<GeneratedCode[]> {
    // This will be implemented by the LLM service
    // For now, return empty array
    return []
  }

  async validateBatch(generated: GeneratedCode[]): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    for (const code of generated) {
      if (!code.code || code.code.trim().length === 0) {
        errors.push(`Empty code generated for ${code.filePath}`)
      }

      if (!code.filePath) {
        errors.push('Missing file path in generated code')
      }

      // Basic syntax check (can be enhanced)
      if (code.code.includes('undefined') && !code.code.includes('//')) {
        warnings.push(`Potential undefined reference in ${code.filePath}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
