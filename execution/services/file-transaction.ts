import { writeFile, readFile, unlink, mkdir } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import { FileValidator, PolicyViolationError } from './file-validator'
import { Config } from '../config'
import { WorkspaceIsolationError } from './file-service'

export interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  backupPath?: string
}

export class FileTransaction {
  private operations: FileOperation[] = []
  private backups: Map<string, string> = new Map()
  private validator: FileValidator
  private config: Config
  private projectPath: string | null = null

  constructor() {
    this.validator = new FileValidator()
    this.config = Config.getInstance()
  }

  /**
   * Get the workspace project path from config
   */
  private async getProjectPath(): Promise<string> {
    if (this.projectPath) {
      return this.projectPath
    }

    try {
      await this.config.load()
      const workspaceConfig = this.config.getWorkspaceConfig()
      this.projectPath = resolve(workspaceConfig.projectPath)
      return this.projectPath
    } catch (error) {
      throw new Error(`Failed to get project path: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Resolve a relative path to an absolute path within the workspace
   */
  private async resolveWorkspacePath(path: string): Promise<string> {
    const projectPath = await this.getProjectPath()
    
    // If path is already absolute, validate it
    if (path.startsWith('/')) {
      const resolvedPath = resolve(path)
      const resolvedProjectPath = resolve(projectPath)
      
      if (!resolvedPath.startsWith(resolvedProjectPath + '/') && resolvedPath !== resolvedProjectPath) {
        throw new WorkspaceIsolationError(
          `Path is outside workspace. Attempted: ${path}, Workspace: ${projectPath}`,
          path,
          projectPath
        )
      }
      return resolvedPath
    }
    
    // Otherwise, resolve relative to workspace
    return resolve(projectPath, path)
  }

  async addOperation(operation: FileOperation): Promise<void> {
    // WORKSPACE ISOLATION: Resolve path to workspace
    const workspacePath = await this.resolveWorkspacePath(operation.path)
    
    // Create backup before modification
    if (operation.type === 'modify' || operation.type === 'delete') {
      try {
        const content = await readFile(workspacePath, 'utf-8')
        const projectPath = await this.getProjectPath()
        const backupPath = join(projectPath, '.backups', `${Date.now()}-${workspacePath.replace(/\//g, '_')}`)
        this.backups.set(workspacePath, backupPath)
        operation.backupPath = backupPath
        
        // Ensure backup directory exists
        await mkdir(join(projectPath, '.backups'), { recursive: true })
        await writeFile(backupPath, content, 'utf-8')
      } catch (error) {
        // File might not exist, that's okay for create operations
        if (operation.type === 'modify') {
          throw new Error(`Cannot modify non-existent file: ${workspacePath}`)
        }
      }
    }

    // Store workspace path in operation
    this.operations.push({
      ...operation,
      path: workspacePath
    })
  }

  async commit(): Promise<void> {
    for (const operation of this.operations) {
      try {
        if (operation.type === 'create' || operation.type === 'modify') {
          if (!operation.content) {
            throw new Error(`No content provided for ${operation.type} operation on ${operation.path}`)
          }
          
          // HARD ENFORCEMENT: Validate against rules before writing
          const rulesValidation = await this.validator.validateAgainstRules(operation.path, operation.content)
          if (!rulesValidation.valid) {
            await this.rollback()
            throw new PolicyViolationError(
              `Policy violation: Cannot ${operation.type} file ${operation.path}`,
              rulesValidation.errors
            )
          }
          
          // Ensure directory exists before writing file
          const dir = dirname(operation.path)
          await mkdir(dir, { recursive: true })
          await writeFile(operation.path, operation.content, 'utf-8')
        } else if (operation.type === 'delete') {
          await unlink(operation.path)
        }
      } catch (error) {
        // Rollback on error
        await this.rollback()
        throw error
      }
    }

    // Clear backups after successful commit
    this.backups.clear()
    this.operations = []
  }

  async rollback(): Promise<void> {
    // Restore from backups
    for (const [originalPath, backupPath] of this.backups.entries()) {
      try {
        const content = await readFile(backupPath, 'utf-8')
        await writeFile(originalPath, content, 'utf-8')
      } catch (error) {
        // Backup might not exist or restore might fail
        console.error(`Failed to restore ${originalPath} from backup:`, error)
      }
    }

    // Clean up backups
    for (const backupPath of this.backups.values()) {
      try {
        await unlink(backupPath)
      } catch (error) {
        // Backup file might not exist
      }
    }

    this.backups.clear()
    this.operations = []
  }

  getOperations(): FileOperation[] {
    return [...this.operations]
  }
}
