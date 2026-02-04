import { writeFile, readFile, unlink, stat } from 'fs/promises'
import { join } from 'path'
import { FileValidator, PolicyViolationError } from './file-validator'
import { FileTransaction } from './file-transaction'
import { Context } from '../types/context'

export interface Conflict {
  path: string
  reason: string
  suggestion: string
}

export class FileService {
  private validator: FileValidator
  private transaction: FileTransaction | null = null

  constructor() {
    this.validator = new FileValidator()
  }

  async createFile(path: string, content: string, validate: boolean = true): Promise<void> {
    if (validate) {
      // HARD ENFORCEMENT: Validate against rules first
      const rulesValidation = await this.validator.validateAgainstRules(path, content)
      if (!rulesValidation.valid) {
        // Determine violation type and suggested fix
        const firstError = rulesValidation.errors[0] || ''
        let violationType = 'unknown'
        let suggestedFix = 'Review the policy violations and fix the code accordingly'
        
        if (firstError.includes('next/document')) {
          violationType = 'forbidden-import'
          suggestedFix = 'Move next/document import to _document.tsx file or remove it'
        } else if (firstError.includes('any')) {
          violationType = 'forbidden-type'
          suggestedFix = 'Replace "any" with "unknown" or a specific type'
        } else if (firstError.includes('try/catch')) {
          violationType = 'missing-error-handling'
          suggestedFix = 'Wrap async operations in try/catch blocks'
        }

        throw new PolicyViolationError(
          `Policy violation: Cannot create file ${path}`,
          rulesValidation.errors,
          path,
          violationType,
          suggestedFix
        )
      }

      // Then validate syntax
      const syntaxValidation = await this.validator.validateSyntax(path, content)
      if (!syntaxValidation.valid) {
        throw new Error(`Validation failed: ${syntaxValidation.errors.join(', ')}`)
      }
    }

    // Ensure directory exists before writing file
    const { mkdir } = await import('fs/promises')
    const { dirname } = await import('path')
    const dir = dirname(path)
    await mkdir(dir, { recursive: true })
    
    await writeFile(path, content, 'utf-8')
  }

  async modifyFile(path: string, changes: Array<{ line: number; content: string }> | string): Promise<void> {
    let newContent: string

    if (typeof changes === 'string') {
      newContent = changes
    } else {
      const currentContent = await readFile(path, 'utf-8')
      const lines = currentContent.split('\n')
      
      for (const change of changes) {
        if (change.line >= 0 && change.line < lines.length) {
          lines[change.line] = change.content
        }
      }
      
      newContent = lines.join('\n')
    }

    // HARD ENFORCEMENT: Validate against rules first
    const rulesValidation = await this.validator.validateAgainstRules(path, newContent)
    if (!rulesValidation.valid) {
      // Determine violation type and suggested fix
      const firstError = rulesValidation.errors[0] || ''
      let violationType = 'unknown'
      let suggestedFix = 'Review the policy violations and fix the code accordingly'
      
      if (firstError.includes('next/document')) {
        violationType = 'forbidden-import'
        suggestedFix = 'Move next/document import to _document.tsx file or remove it'
      } else if (firstError.includes('any')) {
        violationType = 'forbidden-type'
        suggestedFix = 'Replace "any" with "unknown" or a specific type'
      } else if (firstError.includes('try/catch')) {
        violationType = 'missing-error-handling'
        suggestedFix = 'Wrap async operations in try/catch blocks'
      }

      throw new PolicyViolationError(
        `Policy violation: Cannot modify file ${path}`,
        rulesValidation.errors,
        path,
        violationType,
        suggestedFix
      )
    }

    // Then validate syntax
    const validation = await this.validator.validateSyntax(path, newContent)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    // Ensure directory exists before writing file
    const { mkdir } = await import('fs/promises')
    const { dirname } = await import('path')
    const dir = dirname(path)
    await mkdir(dir, { recursive: true })
    
    await writeFile(path, newContent, 'utf-8')
  }

  async deleteFile(path: string): Promise<void> {
    await unlink(path)
  }

  async readFile(path: string): Promise<string> {
    return await readFile(path, 'utf-8')
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      await stat(path)
      return true
    } catch {
      return false
    }
  }

  async detectConflicts(path: string, content: string, context?: Context): Promise<Conflict[]> {
    const conflicts: Conflict[] = []

    // Check if file exists and has different content
    if (await this.fileExists(path)) {
      try {
        const existingContent = await this.readFile(path)
        if (existingContent !== content) {
          conflicts.push({
            path,
            reason: 'File has been modified since last read',
            suggestion: 'Review changes before overwriting'
          })
        }
      } catch (error) {
        // Can't read file, might be a conflict
        conflicts.push({
          path,
          reason: 'Cannot read existing file',
          suggestion: 'Check file permissions'
        })
      }
    }

    // Check for circular dependencies if context provided
    if (context) {
      const fileDeps = context.dependencies.filter(d => d.from === path)
      for (const dep of fileDeps) {
        const circular = context.dependencies.some(d => d.from === dep.to && d.to === path)
        if (circular) {
          conflicts.push({
            path,
            reason: `Circular dependency detected with ${dep.to}`,
            suggestion: 'Refactor to break circular dependency'
          })
        }
      }
    }

    return conflicts
  }

  async validateOperation(operation: { type: string; path: string; content?: string }): Promise<boolean> {
    if (operation.type === 'create' || operation.type === 'modify') {
      if (!operation.content) {
        return false
      }

      // HARD ENFORCEMENT: Check rules first
      const rulesValidation = await this.validator.validateAgainstRules(operation.path, operation.content)
      if (!rulesValidation.valid) {
        return false
      }

      const validation = await this.validator.validateSyntax(operation.path, operation.content)
      return validation.valid
    }

    return true
  }

  startTransaction(): FileTransaction {
    this.transaction = new FileTransaction()
    return this.transaction
  }

  getTransaction(): FileTransaction | null {
    return this.transaction
  }

  async commitTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    await this.transaction.commit()
    this.transaction = null
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    await this.transaction.rollback()
    this.transaction = null
  }
}
