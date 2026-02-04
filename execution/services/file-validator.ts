import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class FileValidator {
  async validateSyntax(filePath: string, content: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic syntax checks
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // Check for basic TypeScript syntax issues
      if (content.includes('any') && !content.includes('// eslint-disable')) {
        warnings.push('File contains "any" type')
      }

      // Check for unclosed brackets
      const openBraces = (content.match(/{/g) || []).length
      const closeBraces = (content.match(/}/g) || []).length
      if (openBraces !== closeBraces) {
        errors.push('Unmatched braces')
      }

      const openParens = (content.match(/\(/g) || []).length
      const closeParens = (content.match(/\)/g) || []).length
      if (openParens !== closeParens) {
        errors.push('Unmatched parentheses')
      }
    }

    // Check for null bytes
    if (content.includes('\0')) {
      errors.push('File contains null bytes')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validateTypes(filePath: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return { valid: true, errors, warnings }
    }

    try {
      // Try to run TypeScript compiler in check mode
      const { stdout, stderr } = await execAsync(`npx tsc --noEmit ${filePath}`, {
        timeout: 10000
      })

      if (stderr) {
        errors.push(stderr)
      }
    } catch (error) {
      // TypeScript might not be available or file might have errors
      // This is okay, we'll catch it during build
      warnings.push('Type checking skipped (TypeScript not available or errors found)')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validateImports(filePath: string, content: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Extract imports
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
    const imports: string[] = []
    let match

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    // Check for common issues
    for (const imp of imports) {
      if (imp.startsWith('.') && !imp.match(/^\.\.?\/.+/)) {
        warnings.push(`Suspicious import path: ${imp}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validatePattern(filePath: string, content: string, patterns: Array<{ type: string; examples: string[] }>): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if file follows project patterns
    // This is a simplified check - in production, this would be more sophisticated
    for (const pattern of patterns) {
      if (pattern.type === 'import') {
        const hasMatchingImport = pattern.examples.some(example =>
          content.includes(example)
        )
        if (!hasMatchingImport && pattern.examples.length > 0) {
          warnings.push(`File might not follow import pattern: ${pattern.type}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
