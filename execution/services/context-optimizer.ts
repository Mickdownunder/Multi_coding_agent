import { readFile, stat } from 'fs/promises'
import { join } from 'path'
import { File, Context, Dependency } from '../types/context'

const MAX_FILES_PER_CALL = 10
const MAX_FILE_SIZE = 50000 // 50KB - summarize larger files

export class ContextOptimizer {
  async selectRelevantFiles(step: { description: string; files?: string[] }, codebase: { files: File[] }): Promise<File[]> {
    // If step specifies files, use those
    if (step.files && step.files.length > 0) {
      const selected: File[] = []
      for (const filePath of step.files) {
        const file = codebase.files.find(f => f.path === filePath)
        if (file) {
          selected.push(file)
        }
      }
      return selected.slice(0, MAX_FILES_PER_CALL)
    }

    // Otherwise, score files by relevance
    const scored = await Promise.all(
      codebase.files.map(async (file) => ({
        file,
        score: await this.scoreRelevance(file, step)
      }))
    )

    // Sort by score and take top N
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, MAX_FILES_PER_CALL).map(item => item.file)
  }

  async scoreRelevance(file: File, step: { description: string }): Promise<number> {
    let score = 0

    // Check if step description mentions file name or path
    const fileName = file.path.split('/').pop() || ''
    if (step.description.toLowerCase().includes(fileName.toLowerCase())) {
      score += 10
    }

    // Check if step description mentions file path
    if (step.description.toLowerCase().includes(file.path.toLowerCase())) {
      score += 5
    }

    // Check file extension relevance
    const ext = file.path.split('.').pop()?.toLowerCase()
    if (step.description.toLowerCase().includes(ext || '')) {
      score += 3
    }

    // Prefer smaller files (easier to process)
    if (file.size < 10000) {
      score += 2
    }

    // Prefer recently modified files
    const age = Date.now() - file.lastModified.getTime()
    if (age < 24 * 60 * 60 * 1000) { // Last 24 hours
      score += 1
    }

    return score
  }

  async summarizeFile(file: File): Promise<string> {
    if (file.size <= MAX_FILE_SIZE) {
      return file.content
    }

    // For large files, create a summary
    const lines = file.content.split('\n')
    const totalLines = lines.length
    
    // Take first 100 lines and last 100 lines
    const firstLines = lines.slice(0, 100).join('\n')
    const lastLines = lines.slice(-100).join('\n')
    
    // Extract key information (imports, exports, class/function definitions)
    const keyLines = lines.filter(line => {
      const trimmed = line.trim()
      return (
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('function ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ')
      )
    }).slice(0, 50).join('\n')

    return `// File: ${file.path} (${totalLines} lines, ${file.size} bytes)
// Summary: Showing first 100 lines, key definitions, and last 100 lines

${firstLines}

// ... (${totalLines - 200} lines omitted) ...

// Key definitions:
${keyLines}

// ... (${totalLines - 200} lines omitted) ...

${lastLines}`
  }

  async getIncrementalContext(previousContext: Context, changes: Array<{ path: string; type: 'created' | 'modified' | 'deleted' }>): Promise<Context> {
    const newFiles: File[] = []
    const modifiedFiles: File[] = []

    for (const change of changes) {
      if (change.type === 'created' || change.type === 'modified') {
        try {
          const content = await readFile(change.path, 'utf-8')
          const stats = await stat(change.path)
          
          const file: File = {
            path: change.path,
            content,
            size: stats.size,
            lastModified: stats.mtime
          }

          if (change.type === 'created') {
            newFiles.push(file)
          } else {
            modifiedFiles.push(file)
          }
        } catch (error) {
          // File might not exist, skip
        }
      }
    }

    // Return only changed files plus their dependencies
    const relevantFiles = [...newFiles, ...modifiedFiles]
    const dependencies = await this.findDependencies(relevantFiles)

    return {
      files: relevantFiles,
      dependencies,
      patterns: previousContext.patterns // Keep existing patterns
    }
  }

  private async findDependencies(files: File[]): Promise<Dependency[]> {
    const dependencies: Dependency[] = []

    for (const file of files) {
      // Simple import/export detection
      const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
      const exportRegex = /export\s+.*?\s+from\s+['"](.+?)['"]/g

      let match
      while ((match = importRegex.exec(file.content)) !== null) {
        dependencies.push({
          from: file.path,
          to: match[1],
          type: 'import'
        })
      }

      while ((match = exportRegex.exec(file.content)) !== null) {
        dependencies.push({
          from: file.path,
          to: match[1],
          type: 'export'
        })
      }
    }

    return dependencies
  }
}
