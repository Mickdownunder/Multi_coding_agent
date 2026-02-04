export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class ResponseValidator {
  validateJSON(content: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      JSON.parse(content)
    } catch (error) {
      errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { valid: false, errors, warnings }
    }

    return { valid: true, errors, warnings }
  }

  validateTokenLimits(content: string, maxTokens: number): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Rough estimate: 1 token ≈ 4 characters
    const estimatedTokens = Math.ceil(content.length / 4)

    if (estimatedTokens > maxTokens) {
      errors.push(`Response exceeds token limit: ${estimatedTokens} > ${maxTokens}`)
      return { valid: false, errors, warnings }
    }

    if (estimatedTokens > maxTokens * 0.9) {
      warnings.push(`Response is close to token limit: ${estimatedTokens} / ${maxTokens}`)
    }

    return { valid: true, errors, warnings }
  }

  validateCompleteness(response: unknown, requiredFields: string[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (typeof response !== 'object' || response === null) {
      errors.push('Response is not an object')
      return { valid: false, errors, warnings }
    }

    for (const field of requiredFields) {
      if (!(field in response)) {
        errors.push(`Missing required field: ${field}`)
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  validatePlanResponse(response: unknown): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (typeof response !== 'object' || response === null) {
      errors.push('Response is not an object')
      return { valid: false, errors, warnings }
    }

    const plan = response as { phases?: unknown }
    if (!plan.phases) {
      errors.push('Missing phases field')
      return { valid: false, errors, warnings }
    }

    if (!Array.isArray(plan.phases)) {
      errors.push('Phases must be an array')
      return { valid: false, errors, warnings }
    }

    for (const phase of plan.phases) {
      if (typeof phase !== 'object' || phase === null) {
        errors.push('Phase must be an object')
        continue
      }

      const p = phase as { name?: unknown; steps?: unknown }
      if (!p.name || typeof p.name !== 'string') {
        errors.push('Phase must have a name')
      }

      if (!p.steps || !Array.isArray(p.steps)) {
        errors.push('Phase must have steps array')
      }
    }

    return { valid: errors.length === 0, errors, warnings }
  }

  validateCodeResponse(response: unknown): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (typeof response !== 'object' || response === null) {
      errors.push('Response is not an object')
      return { valid: false, errors, warnings }
    }

    const code = response as { code?: unknown; files?: unknown }
    if (!code.code && !code.files) {
      errors.push('Response must have either code or files field')
    }

    if (code.files && !Array.isArray(code.files)) {
      errors.push('Files must be an array')
    }

    return { valid: errors.length === 0, errors, warnings }
  }
}
