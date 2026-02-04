import { File, CodePattern } from '../types/context'

export class StructureAnalyzer {
  async analyzeCodebase(files: File[]): Promise<{
    patterns: CodePattern[]
    structure: {
      root: string
      files: string[]
      directories: string[]
    }
  }> {
    const patterns = await this.extractPatterns(files)
    const structure = this.analyzeStructure(files)

    return { patterns, structure }
  }

  private async extractPatterns(files: File[]): Promise<CodePattern[]> {
    const patterns: CodePattern[] = []

    // Extract common patterns
    const importPatterns = this.findImportPatterns(files)
    const exportPatterns = this.findExportPatterns(files)
    const namingPatterns = this.findNamingPatterns(files)

    if (importPatterns.length > 0) {
      patterns.push({
        type: 'import',
        description: 'Import patterns',
        examples: importPatterns
      })
    }

    if (exportPatterns.length > 0) {
      patterns.push({
        type: 'export',
        description: 'Export patterns',
        examples: exportPatterns
      })
    }

    if (namingPatterns.length > 0) {
      patterns.push({
        type: 'naming',
        description: 'Naming conventions',
        examples: namingPatterns
      })
    }

    return patterns
  }

  private findImportPatterns(files: File[]): string[] {
    const patterns = new Set<string>()

    for (const file of files) {
      const importMatches = file.content.match(/import\s+.*?\s+from\s+['"](.+?)['"]/g)
      if (importMatches) {
        importMatches.forEach(match => {
          const path = match.match(/['"](.+?)['"]/)?.[1]
          if (path) {
            patterns.add(path)
          }
        })
      }
    }

    return Array.from(patterns).slice(0, 10) // Limit to 10 examples
  }

  private findExportPatterns(files: File[]): string[] {
    const patterns = new Set<string>()

    for (const file of files) {
      const exportMatches = file.content.match(/export\s+(const|function|class|interface|type)\s+(\w+)/g)
      if (exportMatches) {
        exportMatches.forEach(match => {
          patterns.add(match)
        })
      }
    }

    return Array.from(patterns).slice(0, 10)
  }

  private findNamingPatterns(files: File[]): string[] {
    const patterns = new Set<string>()

    for (const file of files) {
      // Find function/class names
      const functionMatches = file.content.match(/(function|const)\s+(\w+)/g)
      const classMatches = file.content.match(/class\s+(\w+)/g)

      if (functionMatches) {
        functionMatches.forEach(match => {
          patterns.add(match)
        })
      }

      if (classMatches) {
        classMatches.forEach(match => {
          patterns.add(match)
        })
      }
    }

    return Array.from(patterns).slice(0, 10)
  }

  private analyzeStructure(files: File[]): {
    root: string
    files: string[]
    directories: string[]
  } {
    const filePaths = files.map(f => f.path)
    const directories = new Set<string>()

    // Find common root
    if (filePaths.length === 0) {
      return { root: '.', files: [], directories: [] }
    }

    const pathParts = filePaths[0].split('/')
    let commonRoot = ''

    for (let i = 0; i < pathParts.length - 1; i++) {
      const candidate = pathParts.slice(0, i + 1).join('/')
      if (filePaths.every(path => path.startsWith(candidate))) {
        commonRoot = candidate
      } else {
        break
      }
    }

    // Extract directories
    for (const filePath of filePaths) {
      const dir = filePath.substring(0, filePath.lastIndexOf('/'))
      if (dir) {
        directories.add(dir)
      }
    }

    return {
      root: commonRoot || '.',
      files: filePaths,
      directories: Array.from(directories)
    }
  }
}
