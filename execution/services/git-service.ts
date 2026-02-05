import { exec } from 'child_process'
import { promisify } from 'util'
import { GitTransaction } from './git-transaction'
import { Config } from '../config'
import { resolve } from 'path'

const execAsync = promisify(exec)

export interface Diff {
  file: string
  additions: number
  deletions: number
  changes: string
}

export class GitService {
  private transaction: GitTransaction | null = null
  private config: Config
  private projectPath: string | null = null

  constructor() {
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
   * Check if Git repository is initialized in the workspace
   */
  async isInitialized(): Promise<boolean> {
    try {
      const projectPath = await this.getProjectPath()
      await execAsync('git rev-parse --git-dir', { cwd: projectPath })
      return true
    } catch {
      return false
    }
  }

  /**
   * Initialize Git repository in workspace if not already initialized
   */
  async initialize(): Promise<void> {
    try {
      const projectPath = await this.getProjectPath()
      const isInit = await this.isInitialized()
      if (!isInit) {
        await execAsync('git init', { cwd: projectPath })
        // Set default branch to main
        try {
          await execAsync('git branch -M main', { cwd: projectPath })
        } catch {
          // Branch might already exist or command not available
        }
      }
    } catch (error) {
      throw new Error(`Failed to initialize Git repository in workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async commit(message: string, files: string[]): Promise<string> {
    // WORKSPACE ISOLATION: All Git operations must be in workspace
    const projectPath = await this.getProjectPath()
    const { resolve } = await import('path')
    const { stat } = await import('fs/promises')
    
    // HARD CHECK: Verify Git repository exists in workspace before attempting commit
    const isInit = await this.isInitialized()
    if (!isInit) {
      throw new Error(`Git repository is not initialized in workspace (${projectPath}). Cannot commit. Call initialize() first.`)
    }

    try {
      // PFAD-PRÄZISION: Validate and filter files before staging
      const validFiles: string[] = []
      const invalidFiles: string[] = []
      
      for (const file of files) {
        // Resolve file path
        let resolvedPath: string
        if (file.startsWith('/')) {
          // Absolute path
          resolvedPath = resolve(file)
        } else {
          // Relative path - resolve relative to workspace
          resolvedPath = resolve(projectPath, file)
        }
        
        // HARD CHECK: File must be within workspace
        const resolvedProjectPath = resolve(projectPath)
        if (!resolvedPath.startsWith(resolvedProjectPath + '/') && resolvedPath !== resolvedProjectPath) {
          invalidFiles.push(file)
          continue
        }
        
        // Check if file exists
        try {
          await stat(resolvedPath)
          // File exists and is in workspace - add relative path for git
          const relativePath = resolvedPath.replace(resolvedProjectPath + '/', '')
          validFiles.push(relativePath)
        } catch {
          // File doesn't exist - skip it (graceful handling)
          invalidFiles.push(file)
        }
      }
      
      // GIT-BEREINIGUNG: Blockiere System-Dateien (plan.md, report.md, etc.) endgültig
      const systemFiles = invalidFiles.filter(f => 
        f.includes('control-system') || 
        f.includes('/control/') || 
        f.includes('control/plan.md') || 
        f.includes('control/report.md') ||
        f.includes('control/intent.md') ||
        f.includes('control/rules.md')
      )
      
      if (systemFiles.length > 0) {
        // System-Dateien dürfen NIEMALS im Workspace-Git landen
        console.warn(`[GitService] BLOCKED: System files cannot be committed to workspace: ${systemFiles.join(', ')}`)
      }
      
      // Log invalid files (but don't fail)
      if (invalidFiles.length > 0) {
        // Return 'no-changes' if all files are invalid (graceful)
        if (validFiles.length === 0) {
          return 'no-changes'
        }
        // Log warning but continue with valid files
        console.warn(`[GitService] Skipping files outside workspace or not found: ${invalidFiles.join(', ')}`)
      }
      
      // Stage only valid files (paths are relative to workspace)
      if (validFiles.length > 0) {
        const addResult = await execAsync(`git add ${validFiles.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ')}`, { cwd: projectPath })
        // Verify add succeeded
        if (addResult.stderr && !addResult.stderr.includes('warning')) {
          // Check if it's a "pathspec" error (file not found) - graceful handling
          if (addResult.stderr.includes('pathspec') || addResult.stderr.includes('did not match any files')) {
            return 'no-changes'
          }
          throw new Error(`Git add failed: ${addResult.stderr}`)
        }
      } else {
        // No valid files to stage
        return 'no-changes'
      }

      // Commit in workspace
      const commitResult = await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: projectPath })
      
      // Extract commit hash from output
      const commitHashMatch = commitResult.stdout.match(/\[(\w+)\]/) || commitResult.stdout.match(/([a-f0-9]{7,})/)
      if (!commitHashMatch) {
        // Check if this is a "nothing to commit" case (this is OK, not an error)
        const output = (commitResult.stdout + ' ' + commitResult.stderr).toLowerCase()
        if (output.includes('nothing to commit') || output.includes('no changes') || output.includes('nothing added to commit')) {
          // This is expected - no changes to commit, continue execution
          return 'no-changes'
        }
        // If no hash found and it's not "nothing to commit", something went wrong
        throw new Error(`Git commit output unclear. stdout: ${commitResult.stdout}, stderr: ${commitResult.stderr}`)
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
      
      // FEHLERTOLERANZ: "nothing to commit" ist KEIN Fehler - einfach weitermachen
      const errorOutput = errorMsg.toLowerCase()
      if (errorOutput.includes('nothing to commit') || 
          errorOutput.includes('no changes') || 
          errorOutput.includes('nothing added to commit') ||
          errorOutput.includes('working tree clean')) {
        // Kein Fehler - einfach 'no-changes' zurückgeben und weitermachen
        return 'no-changes'
      }
      
      // Nur echte Fehler werfen
      throw new Error(`Git commit failed in workspace (${projectPath}): ${errorMsg}`)
    }
  }

  async createCheckpoint(tag: string): Promise<void> {
    try {
      const projectPath = await this.getProjectPath()
      await execAsync(`git tag ${tag}`, { cwd: projectPath })
    } catch (error) {
      throw new Error(`Failed to create checkpoint in workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async rollbackToCheckpoint(tag: string): Promise<void> {
    try {
      const projectPath = await this.getProjectPath()
      await execAsync(`git reset --hard ${tag}`, { cwd: projectPath })
    } catch (error) {
      throw new Error(`Failed to rollback to checkpoint in workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async getDiff(commit1: string, commit2: string): Promise<Diff[]> {
    try {
      const projectPath = await this.getProjectPath()
      const { stdout } = await execAsync(`git diff --stat ${commit1} ${commit2}`, { cwd: projectPath })
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
      const projectPath = await this.getProjectPath()
      // Check if there are changes to commit in workspace
      const { stdout } = await execAsync('git status --porcelain', { cwd: projectPath })
      return stdout.trim().length > 0
    } catch (error) {
      return false
    }
  }

  /**
   * Add remote repository (workspace-scoped)
   */
  async addRemote(name: string, url: string): Promise<void> {
    try {
      const projectPath = await this.getProjectPath()
      
      // Check if remote already exists in workspace
      try {
        const { stdout } = await execAsync(`git remote get-url ${name}`, { cwd: projectPath })
        if (stdout.trim() === url) {
          // Remote already exists with same URL, that's fine
          return
        }
        // Remote exists with different URL, update it
        await execAsync(`git remote set-url ${name} ${url}`, { cwd: projectPath })
      } catch {
        // Remote doesn't exist, add it
        await execAsync(`git remote add ${name} ${url}`, { cwd: projectPath })
      }
    } catch (error) {
      throw new Error(`Failed to add remote in workspace: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Push to remote repository (workspace-scoped)
   */
  async push(remote: string = 'origin', branch: string = 'main', force: boolean = false): Promise<void> {
    // WORKSPACE ISOLATION: All Git operations must be in workspace
    const projectPath = await this.getProjectPath()
    
    // HARD CHECK: Verify Git repository exists in workspace before attempting push
    const isInit = await this.isInitialized()
    if (!isInit) {
      throw new Error(`Git repository is not initialized in workspace (${projectPath}). Cannot push. Call initialize() first.`)
    }

    // HARD CHECK: Verify remote exists in workspace
    let remoteUrl: string | null = null
    try {
      const remoteResult = await execAsync(`git remote get-url ${remote}`, { cwd: projectPath })
      remoteUrl = remoteResult.stdout.trim()
      if (!remoteUrl) {
        throw new Error(`Remote '${remote}' exists but has no URL configured.`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Remote '${remote}' does not exist or is not configured in workspace. Use addRemote() first. Error: ${errorMsg}`)
    }

    try {
      // Push to remote from workspace
      const forceFlag = force ? '--force' : ''
      const pushResult = await execAsync(`git push ${forceFlag} ${remote} ${branch}`.trim(), { cwd: projectPath })
      
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
      
      // GIT-BEREINIGUNG: Git push/commit Fehler sind Warnungen, nicht fatal
      // Nur bei fatalen Dateifehlern auf FAIL setzen
      const isFatalError = errorMsg.includes('fatal:') && (
        errorMsg.includes('cannot lock') ||
        errorMsg.includes('corrupt') ||
        errorMsg.includes('invalid object') ||
        errorMsg.includes('repository not found')
      )
      
      if (isFatalError) {
        throw new Error(`FATAL Git error in workspace (${projectPath}): ${errorMsg}`)
      }
      
      // Non-fatal errors (auth, network, etc.): Log warning but don't throw
      // This allows execution to continue even if push fails
      console.warn(`[GitService] Git push warning (non-fatal, execution continues): ${errorMsg}`)
      // Don't throw - just return to allow execution to continue
      return
    }
  }

  /**
   * Get remote URL (workspace-scoped)
   */
  async getRemoteUrl(name: string = 'origin'): Promise<string | null> {
    try {
      const projectPath = await this.getProjectPath()
      const { stdout } = await execAsync(`git remote get-url ${name}`, { cwd: projectPath })
      return stdout.trim()
    } catch {
      return null
    }
  }

  /**
   * List all remotes (workspace-scoped)
   */
  async listRemotes(): Promise<Array<{ name: string; url: string }>> {
    try {
      const projectPath = await this.getProjectPath()
      const { stdout } = await execAsync('git remote -v', { cwd: projectPath })
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
