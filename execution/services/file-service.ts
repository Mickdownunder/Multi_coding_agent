import { writeFile, readFile, unlink, stat, mkdir } from 'fs/promises'
import { join, resolve, relative, dirname } from 'path'
import { FileValidator, PolicyViolationError } from './file-validator'
import { FileTransaction } from './file-transaction'
import { Context } from '../types/context'
import { Config } from '../config'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface Conflict {
  path: string
  reason: string
  suggestion: string
}

export class WorkspaceIsolationError extends Error {
  constructor(message: string, public readonly attemptedPath: string, public readonly workspacePath: string) {
    super(message)
    this.name = 'WorkspaceIsolationError'
  }
}

export class FileService {
  private validator: FileValidator
  private transaction: FileTransaction | null = null
  private config: Config
  private projectPath: string | null = null
  private workspaceInitialized: boolean = false

  constructor() {
    this.validator = new FileValidator()
    this.config = Config.getInstance()
  }

  /**
   * Get the workspace project path from config
   * Ensures workspace is initialized if autoInit is enabled
   */
  private async getProjectPath(): Promise<string> {
    if (this.projectPath) {
      return this.projectPath
    }

    try {
      await this.config.load()
      const workspaceConfig = this.config.getWorkspaceConfig()
      this.projectPath = resolve(workspaceConfig.projectPath)
      
      // Auto-initialize workspace if enabled
      if (workspaceConfig.autoInit && !this.workspaceInitialized) {
        await this.ensureWorkspaceExists()
        this.workspaceInitialized = true
      }
      
      return this.projectPath
    } catch (error) {
      throw new Error(`Failed to get project path: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Ensure workspace directory exists and initialize Git if needed
   * Also sets up the agent's GitHub remote if configured
   */
  private async ensureWorkspaceExists(): Promise<void> {
    const projectPath = await this.getProjectPath()
    
    try {
      // Check if directory exists
      try {
        await stat(projectPath)
      } catch {
        // Directory doesn't exist, create it
        await mkdir(projectPath, { recursive: true })
      }

      // Check if Git is initialized in workspace (NOT in control-system!)
      let gitInitialized = false
      try {
        await execAsync('git rev-parse --git-dir', { cwd: projectPath })
        gitInitialized = true
      } catch {
        // Git not initialized in workspace, initialize it ONLY in workspace
        await execAsync('git init', { cwd: projectPath })
        try {
          await execAsync('git branch -M main', { cwd: projectPath })
        } catch {
          // Branch might already exist
        }
        gitInitialized = true
      }

      // If Git was just initialized or exists, check/set up remote for agent's repo
      if (gitInitialized) {
        const workspaceConfig = this.config.getWorkspaceConfig()
        const agentRepoUrl = workspaceConfig.remoteUrl || 'https://github.com/Mickdownunder/Passwort-App.git'
        try {
          const remoteCheck = await execAsync('git remote get-url origin', { cwd: projectPath })
          const existingUrl = remoteCheck.stdout.trim()
          if (existingUrl && existingUrl !== agentRepoUrl) {
            await execAsync(`git remote set-url origin ${agentRepoUrl}`, { cwd: projectPath })
          }
        } catch {
          try {
            await execAsync(`git remote add origin ${agentRepoUrl}`, { cwd: projectPath })
          } catch {
            // Remote might already exist or URL invalid - that's okay
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize workspace at ${projectPath}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate that a path is within the workspace
   * Throws WorkspaceIsolationError if path is outside workspace
   */
  private async validatePathInWorkspace(path: string): Promise<void> {
    const projectPath = await this.getProjectPath()
    const resolvedPath = resolve(path)
    const resolvedProjectPath = resolve(projectPath)
    
    // Check if path is within workspace
    if (!resolvedPath.startsWith(resolvedProjectPath + '/') && resolvedPath !== resolvedProjectPath) {
      throw new WorkspaceIsolationError(
        `Path is outside workspace. Attempted: ${path}, Workspace: ${projectPath}`,
        path,
        projectPath
      )
    }
  }

  /**
   * Resolve a relative path to an absolute path within the workspace
   */
  private async resolveWorkspacePath(path: string): Promise<string> {
    const projectPath = await this.getProjectPath()
    
    // If path is already absolute, validate it
    if (path.startsWith('/')) {
      await this.validatePathInWorkspace(path)
      return resolve(path)
    }
    
    // Otherwise, resolve relative to workspace
    return resolve(projectPath, path)
  }

  async createFile(path: string, content: string, validate: boolean = true): Promise<void> {
    // WORKSPACE ISOLATION: Resolve path to workspace and validate
    const workspacePath = await this.resolveWorkspacePath(path)
    await this.validatePathInWorkspace(workspacePath)

    if (validate) {
      // HARD ENFORCEMENT: Validate against rules first
      const rulesValidation = await this.validator.validateAgainstRules(workspacePath, content)
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
          `Policy violation: Cannot create file ${workspacePath}`,
          rulesValidation.errors,
          workspacePath,
          violationType,
          suggestedFix
        )
      }

      // Then validate syntax
      const syntaxValidation = await this.validator.validateSyntax(workspacePath, content)
      if (!syntaxValidation.valid) {
        throw new Error(`Validation failed: ${syntaxValidation.errors.join(', ')}`)
      }
    }

    // Ensure directory exists before writing file
    const dir = dirname(workspacePath)
    await mkdir(dir, { recursive: true })
    
    await writeFile(workspacePath, content, 'utf-8')
  }

  async modifyFile(path: string, changes: Array<{ line: number; content: string }> | string): Promise<void> {
    // WORKSPACE ISOLATION: Resolve path to workspace and validate
    const workspacePath = await this.resolveWorkspacePath(path)
    await this.validatePathInWorkspace(workspacePath)

    let newContent: string

    if (typeof changes === 'string') {
      newContent = changes
    } else {
      const currentContent = await readFile(workspacePath, 'utf-8')
      const lines = currentContent.split('\n')
      
      for (const change of changes) {
        if (change.line >= 0 && change.line < lines.length) {
          lines[change.line] = change.content
        }
      }
      
      newContent = lines.join('\n')
    }

    // HARD ENFORCEMENT: Validate against rules first
    const rulesValidation = await this.validator.validateAgainstRules(workspacePath, newContent)
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
        `Policy violation: Cannot modify file ${workspacePath}`,
        rulesValidation.errors,
        workspacePath,
        violationType,
        suggestedFix
      )
    }

    // Then validate syntax
    const validation = await this.validator.validateSyntax(workspacePath, newContent)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    // Ensure directory exists before writing file
    const dir = dirname(workspacePath)
    await mkdir(dir, { recursive: true })
    
    await writeFile(workspacePath, newContent, 'utf-8')
  }

  async deleteFile(path: string): Promise<void> {
    // WORKSPACE ISOLATION: Resolve path to workspace and validate
    const workspacePath = await this.resolveWorkspacePath(path)
    await this.validatePathInWorkspace(workspacePath)
    await unlink(workspacePath)
  }

  async readFile(path: string): Promise<string> {
    // WORKSPACE ISOLATION: Resolve path to workspace and validate
    const workspacePath = await this.resolveWorkspacePath(path)
    await this.validatePathInWorkspace(workspacePath)
    return await readFile(workspacePath, 'utf-8')
  }

  async fileExists(path: string): Promise<boolean> {
    try {
      // WORKSPACE ISOLATION: Resolve path to workspace and validate
      const workspacePath = await this.resolveWorkspacePath(path)
      await this.validatePathInWorkspace(workspacePath)
      await stat(workspacePath)
      return true
    } catch {
      return false
    }
  }

  async detectConflicts(path: string, content: string, context?: Context): Promise<Conflict[]> {
    // WORKSPACE ISOLATION: Resolve path to workspace
    const workspacePath = await this.resolveWorkspacePath(path)
    await this.validatePathInWorkspace(workspacePath)

    const conflicts: Conflict[] = []

    // Check if file exists and has different content
    if (await this.fileExists(workspacePath)) {
      try {
        const existingContent = await this.readFile(workspacePath)
        if (existingContent !== content) {
          conflicts.push({
            path: workspacePath,
            reason: 'File has been modified since last read',
            suggestion: 'Review changes before overwriting'
          })
        }
      } catch (error) {
        // Can't read file, might be a conflict
        conflicts.push({
          path: workspacePath,
          reason: 'Cannot read existing file',
          suggestion: 'Check file permissions'
        })
      }
    }

    // Check for circular dependencies if context provided
    if (context) {
      const fileDeps = context.dependencies.filter(d => d.from === workspacePath)
      for (const dep of fileDeps) {
        const circular = context.dependencies.some(d => d.from === dep.to && d.to === workspacePath)
        if (circular) {
          conflicts.push({
            path: workspacePath,
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
