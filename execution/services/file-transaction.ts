import { writeFile, readFile, unlink } from 'fs/promises'
import { join } from 'path'

export interface FileOperation {
  type: 'create' | 'modify' | 'delete'
  path: string
  content?: string
  backupPath?: string
}

export class FileTransaction {
  private operations: FileOperation[] = []
  private backups: Map<string, string> = new Map()

  async addOperation(operation: FileOperation): Promise<void> {
    // Create backup before modification
    if (operation.type === 'modify' || operation.type === 'delete') {
      try {
        const content = await readFile(operation.path, 'utf-8')
        const backupPath = join(process.cwd(), 'control', '.backups', `${Date.now()}-${operation.path.replace(/\//g, '_')}`)
        this.backups.set(operation.path, backupPath)
        operation.backupPath = backupPath
        
        // Ensure backup directory exists
        const { mkdir } = await import('fs/promises')
        await mkdir(join(process.cwd(), 'control', '.backups'), { recursive: true })
        await writeFile(backupPath, content, 'utf-8')
      } catch (error) {
        // File might not exist, that's okay for create operations
        if (operation.type === 'modify') {
          throw new Error(`Cannot modify non-existent file: ${operation.path}`)
        }
      }
    }

    this.operations.push(operation)
  }

  async commit(): Promise<void> {
    const { mkdir } = await import('fs/promises')
    const { dirname } = await import('path')
    
    for (const operation of this.operations) {
      try {
        if (operation.type === 'create' || operation.type === 'modify') {
          if (!operation.content) {
            throw new Error(`No content provided for ${operation.type} operation on ${operation.path}`)
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
