import { exec } from 'child_process'
import { promisify } from 'util'
import { GitTransaction } from './git-transaction'

const execAsync = promisify(exec)

export interface Diff {
  file: string
  additions: number
  deletions: number
  changes: string
}

export class GitService {
  private transaction: GitTransaction | null = null

  /**
   * Check if Git repository is initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --git-dir')
      return true
    } catch {
      return false
    }
  }

  /**
   * Initialize Git repository if not already initialized
   */
  async initialize(): Promise<void> {
    try {
      const isInit = await this.isInitialized()
      if (!isInit) {
        await execAsync('git init')
        // Set default branch to main
        try {
          await execAsync('git branch -M main')
        } catch {
          // Branch might already exist or command not available
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize Git repository: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async commit(message: string, files: string[]): Promise<string> {
    try {
      // Ensure Git is initialized before committing
      const isInit = await this.isInitialized()
      if (!isInit) {
        await this.initialize()
      }

      // Stage files
      if (files.length > 0) {
        await execAsync(`git add ${files.join(' ')}`)
      }

      // Commit
      const { stdout } = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`)
      const commitHash = stdout.match(/\[(\w+)\]/)?.[1] || 'unknown'
      return commitHash
    } catch (error) {
      // If commit fails because of no changes, that's okay
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errorMsg.includes('nothing to commit') || errorMsg.includes('no changes')) {
        return 'no-changes'
      }
      throw new Error(`Git commit failed: ${errorMsg}`)
    }
  }

  async createCheckpoint(tag: string): Promise<void> {
    try {
      await execAsync(`git tag ${tag}`)
    } catch (error) {
      throw new Error(`Failed to create checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async rollbackToCheckpoint(tag: string): Promise<void> {
    try {
      await execAsync(`git reset --hard ${tag}`)
    } catch (error) {
      throw new Error(`Failed to rollback to checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getDiff(commit1: string, commit2: string): Promise<Diff[]> {
    try {
      const { stdout } = await execAsync(`git diff --stat ${commit1} ${commit2}`)
      // Parse diff output (simplified)
      const diffs: Diff[] = []
      const lines = stdout.split('\n')
      
      for (const line of lines) {
        const match = line.match(/(.+?)\s+\|\s+(\d+)\s+([+-]+)/)
        if (match) {
          diffs.push({
            file: match[1].trim(),
            additions: parseInt(match[2], 10),
            deletions: 0,
            changes: match[3]
          })
        }
      }
      
      return diffs
    } catch (error) {
      return []
    }
  }

  async validateBeforeCommit(): Promise<boolean> {
    try {
      // Check if there are changes to commit
      const { stdout } = await execAsync('git status --porcelain')
      return stdout.trim().length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Add remote repository
   */
  async addRemote(name: string, url: string): Promise<void> {
    try {
      // Check if remote already exists
      try {
        const { stdout } = await execAsync(`git remote get-url ${name}`)
        if (stdout.trim() === url) {
          // Remote already exists with same URL, that's fine
          return
        }
        // Remote exists with different URL, update it
        await execAsync(`git remote set-url ${name} ${url}`)
      } catch {
        // Remote doesn't exist, add it
        await execAsync(`git remote add ${name} ${url}`)
      }
    } catch (error) {
      throw new Error(`Failed to add remote: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Push to remote repository
   */
  async push(remote: string = 'origin', branch: string = 'main', force: boolean = false): Promise<void> {
    try {
      // Check if remote exists
      try {
        await execAsync(`git remote get-url ${remote}`)
      } catch {
        throw new Error(`Remote '${remote}' does not exist. Use addRemote() first.`)
      }

      // Push to remote
      const forceFlag = force ? '--force' : ''
      await execAsync(`git push ${forceFlag} ${remote} ${branch}`.trim())
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Git push failed: ${errorMsg}`)
    }
  }

  /**
   * Get remote URL
   */
  async getRemoteUrl(name: string = 'origin'): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`git remote get-url ${name}`)
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * List all remotes
   */
  async listRemotes(): Promise<Array<{ name: string; url: string }>> {
    try {
      const { stdout } = await execAsync('git remote -v')
      const remotes: Array<{ name: string; url: string }> = []
      const seen = new Set<string>()
      
      for (const line of stdout.split('\n')) {
        const match = line.match(/^(\S+)\s+(\S+)/)
        if (match) {
          const name = match[1]
          const url = match[2]
          const key = `${name}:${url}`
          if (!seen.has(key)) {
            seen.add(key)
            remotes.push({ name, url })
          }
        }
      }
      
      return remotes
    } catch {
      return []
    }
  }

  startTransaction(): GitTransaction {
    this.transaction = new GitTransaction()
    return this.transaction
  }

  getTransaction(): GitTransaction | null {
    return this.transaction
  }

  async commitTransaction(): Promise<string> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    const commitHash = await this.transaction.commit()
    this.transaction = null
    return commitHash
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.transaction) {
      throw new Error('No active transaction')
    }

    await this.transaction.rollback()
    this.transaction = null
  }

  private async atomicCommit(files: Array<{ path: string; content: string }>): Promise<string> {
    // Create transaction for atomic commit
    const transaction = this.startTransaction()

    // Add all files
    for (const file of files) {
      transaction.addOperation({
        type: 'add',
        files: [file.path]
      })
    }

    // Commit
    transaction.addOperation({
      type: 'commit',
      message: 'Atomic commit'
    })

    return await this.commitTransaction()
  }
}
