import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface GitOperation {
  type: 'add' | 'commit' | 'tag' | 'branch'
  files?: string[]
  message?: string
  tag?: string
  branch?: string
}

export class GitTransaction {
  private operations: GitOperation[] = []
  private committed = false

  async addOperation(operation: GitOperation): Promise<void> {
    this.operations.push(operation)
  }

  async commit(): Promise<string> {
    if (this.committed) {
      throw new Error('Transaction already committed')
    }

    try {
      // Ensure Git is initialized
      try {
        await execAsync('git rev-parse --git-dir')
      } catch {
        // Git not initialized, initialize it
        await execAsync('git init')
        try {
          await execAsync('git branch -M main')
        } catch {
          // Branch command might not be available
        }
      }

      // Stage all files
      const filesToAdd = new Set<string>()
      for (const op of this.operations) {
        if (op.type === 'add' && op.files) {
          op.files.forEach(f => filesToAdd.add(f))
        }
      }

      if (filesToAdd.size > 0) {
        await execAsync(`git add ${Array.from(filesToAdd).join(' ')}`)
      }

      // Commit
      const commitMessage = this.operations.find(op => op.type === 'commit')?.message || 'Auto-commit'
      const { stdout } = await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)
      
      const commitHash = stdout.match(/\[(\w+)\]/)?.[1] || 'unknown'
      this.committed = true

      // Create tag if specified
      const tagOp = this.operations.find(op => op.type === 'tag')
      if (tagOp?.tag) {
        await execAsync(`git tag ${tagOp.tag}`)
      }

      return commitHash
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      // If commit fails because of no changes, that's okay
      if (errorMsg.includes('nothing to commit') || errorMsg.includes('no changes')) {
        return 'no-changes'
      }
      throw new Error(`Git commit failed: ${errorMsg}`)
    }
  }

  async rollback(): Promise<void> {
    // Reset staged changes
    try {
      await execAsync('git reset HEAD')
    } catch (error) {
      // Might not have staged changes
    }

    this.operations = []
    this.committed = false
  }

  getOperations(): GitOperation[] {
    return [...this.operations]
  }
}
