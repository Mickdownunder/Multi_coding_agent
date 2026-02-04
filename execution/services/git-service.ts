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
    // HARD CHECK: Verify Git repository exists before attempting commit
    const isInit = await this.isInitialized()
    if (!isInit) {
      throw new Error('Git repository is not initialized. Cannot commit. Call initialize() first or ensure you are in a Git repository.')
    }

    try {
      // Stage files
      if (files.length > 0) {
        const addResult = await execAsync(`git add ${files.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ')}`)
        // Verify add succeeded
        if (addResult.stderr && !addResult.stderr.includes('warning')) {
          throw new Error(`Git add failed: ${addResult.stderr}`)
        }
      }

      // Commit
      const commitResult = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`)
      
      // Extract commit hash from output
      const commitHashMatch = commitResult.stdout.match(/\[(\w+)\]/) || commitResult.stdout.match(/([a-f0-9]{7,})/)
      if (!commitHashMatch) {
        // If no hash found, verify commit actually succeeded
        if (commitResult.stderr && !commitResult.stderr.includes('nothing to commit')) {
          throw new Error(`Git commit output unclear. stdout: ${commitResult.stdout}, stderr: ${commitResult.stderr}`)
        }
        // No changes to commit
        return 'no-changes'
      }
      
      const commitHash = commitHashMatch[1]
      
      // Verify commit hash is valid (not 'unknown' or empty)
      if (!commitHash || commitHash === 'unknown' || commitHash.length < 7) {
        throw new Error(`Invalid commit hash extracted: ${commitHash}. Git commit may have failed.`)
      }
      
      return commitHash
    } catch (error) {
      // Extract real error message
      let errorMsg = 'Unknown error'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'object' && error !== null && 'stderr' in error) {
        const execError = error as { stderr?: string; stdout?: string; message?: string }
        errorMsg = execError.stderr || execError.message || 'Unknown error'
      }
      
      // If commit fails because of no changes, that's okay
      if (errorMsg.includes('nothing to commit') || errorMsg.includes('no changes') || errorMsg.includes('nothing added to commit')) {
        return 'no-changes'
      }
      
      // Throw real error with actual error message
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
    // HARD CHECK: Verify Git repository exists before attempting push
    const isInit = await this.isInitialized()
    if (!isInit) {
      throw new Error('Git repository is not initialized. Cannot push. Call initialize() first or ensure you are in a Git repository.')
    }

    // HARD CHECK: Verify remote exists
    let remoteUrl: string | null = null
    try {
      const remoteResult = await execAsync(`git remote get-url ${remote}`)
      remoteUrl = remoteResult.stdout.trim()
      if (!remoteUrl) {
        throw new Error(`Remote '${remote}' exists but has no URL configured.`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Remote '${remote}' does not exist or is not configured. Use addRemote() first. Error: ${errorMsg}`)
    }

    try {
      // Push to remote
      const forceFlag = force ? '--force' : ''
      const pushResult = await execAsync(`git push ${forceFlag} ${remote} ${branch}`.trim())
      
      // Verify push actually succeeded
      if (pushResult.stderr && !pushResult.stderr.includes('up to date') && !pushResult.stderr.includes('To ')) {
        // Check for authentication errors
        if (pushResult.stderr.includes('authentication') || pushResult.stderr.includes('permission denied') || pushResult.stderr.includes('403')) {
          throw new Error(`Git push authentication failed. Check your credentials for remote '${remote}' (${remoteUrl}). Error: ${pushResult.stderr}`)
        }
        // Check for other errors
        if (pushResult.stderr.includes('error') || pushResult.stderr.includes('fatal')) {
          throw new Error(`Git push failed: ${pushResult.stderr}`)
        }
      }
      
      // Verify we got some indication of success
      if (!pushResult.stdout && !pushResult.stderr.includes('up to date') && !pushResult.stderr.includes('To ')) {
        throw new Error(`Git push output unclear. No indication of success. stdout: ${pushResult.stdout}, stderr: ${pushResult.stderr}`)
      }
    } catch (error) {
      // Extract real error message
      let errorMsg = 'Unknown error'
      if (error instanceof Error) {
        errorMsg = error.message
      } else if (typeof error === 'object' && error !== null && 'stderr' in error) {
        const execError = error as { stderr?: string; stdout?: string; message?: string }
        errorMsg = execError.stderr || execError.message || 'Unknown error'
        
        // Provide specific error messages for common issues
        if (errorMsg.includes('authentication') || errorMsg.includes('permission denied') || errorMsg.includes('403')) {
          errorMsg = `Authentication failed for remote '${remote}' (${remoteUrl}). Check your credentials.`
        } else if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
          errorMsg = `Remote repository not found: ${remoteUrl}. Verify the repository exists and you have access.`
        } else if (errorMsg.includes('connection') || errorMsg.includes('timeout')) {
          errorMsg = `Connection failed to remote '${remote}' (${remoteUrl}). Check your network connection.`
        }
      }
      
      // Throw real error with actual error message
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
