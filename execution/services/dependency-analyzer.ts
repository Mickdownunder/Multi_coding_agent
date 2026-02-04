import { readFile } from 'fs/promises'
import { Dependency, File } from '../types/context'

export class DependencyAnalyzer {
  async analyzeFile(file: File): Promise<Dependency[]> {
    const dependencies: Dependency[] = []

    // Parse imports/exports
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
    const exportRegex = /export\s+.*?\s+from\s+['"](.+?)['"]/g
    const requireRegex = /require\(['"](.+?)['"]\)/g

    let match
    while ((match = importRegex.exec(file.content)) !== null) {
      dependencies.push({
        from: file.path,
        to: this.resolvePath(match[1], file.path),
        type: 'import'
      })
    }

    while ((match = exportRegex.exec(file.content)) !== null) {
      dependencies.push({
        from: file.path,
        to: this.resolvePath(match[1], file.path),
        type: 'export'
      })
    }

    while ((match = requireRegex.exec(file.content)) !== null) {
      dependencies.push({
        from: file.path,
        to: this.resolvePath(match[1], file.path),
        type: 'import'
      })
    }

    return dependencies
  }

  async buildDependencyGraph(files: File[]): Promise<Map<string, string[]>> {
    const graph = new Map<string, string[]>()

    for (const file of files) {
      const deps = await this.analyzeFile(file)
      const depPaths = deps.map(d => d.to)
      graph.set(file.path, depPaths)
    }

    return graph
  }

  async findCircularDependencies(files: File[]): Promise<string[][]> {
    const graph = await this.buildDependencyGraph(files)
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (node: string, path: string[]): void => {
      visited.add(node)
      recStack.add(node)
      path.push(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path])
        } else if (recStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor)
          cycles.push(path.slice(cycleStart))
        }
      }

      recStack.delete(node)
    }

    for (const file of files) {
      if (!visited.has(file.path)) {
        dfs(file.path, [])
      }
    }

    return cycles
  }

  private resolvePath(importPath: string, fromFile: string): string {
    // Simple path resolution
    // In a real implementation, this would handle node_modules, relative paths, etc.
    if (importPath.startsWith('.')) {
      const { dirname, join } = require('path')
      return join(dirname(fromFile), importPath)
    }
    return importPath
  }
}
