import { readFile, stat, readdir } from 'fs/promises'
import { join } from 'path'
import { File, Context, Codebase } from '../types/context'
import { DependencyAnalyzer } from './dependency-analyzer'
import { StructureAnalyzer } from './structure-analyzer'
import { ContextCache } from './context-cache'

export class ContextService {
  private dependencyAnalyzer: DependencyAnalyzer
  private structureAnalyzer: StructureAnalyzer
  private cache: ContextCache
  private cachedContext: Context | null = null

  constructor() {
    this.dependencyAnalyzer = new DependencyAnalyzer()
    this.structureAnalyzer = new StructureAnalyzer()
    this.cache = new ContextCache()
  }

  async loadContext(rootDir: string = process.cwd()): Promise<Context> {
    // Check cache first
    const cached = this.cache.get('main')
    if (cached && !(await this.cache.isStale('main'))) {
      this.cachedContext = cached.context
      return cached.context
    }

    // Load files
    const files = await this.loadFiles(rootDir)
    
    // Analyze dependencies
    const dependencies = await this.dependencyAnalyzer.buildDependencyGraph(files)
    const depArray = Array.from(dependencies.entries()).flatMap(([from, tos]) =>
      tos.map(to => ({ from, to, type: 'import' as const }))
    )

    // Analyze structure
    const { patterns, structure } = await this.structureAnalyzer.analyzeCodebase(files)

    const context: Context = {
      files,
      dependencies: depArray,
      patterns
    }

    // Cache context
    this.cache.set('main', context)
    await this.cache.save()

    this.cachedContext = context
    return context
  }

  async getCodebase(rootDir: string = process.cwd()): Promise<Codebase> {
    const context = await this.loadContext(rootDir)
    const { structure } = await this.structureAnalyzer.analyzeCodebase(context.files)

    return {
      files: context.files,
      structure
    }
  }

  async updateContext(changes: Array<{ path: string; type: 'created' | 'modified' | 'deleted' }>): Promise<Context> {
    if (!this.cachedContext) {
      return await this.loadContext()
    }

    // Update cached context with changes
    for (const change of changes) {
      if (change.type === 'deleted') {
        this.cachedContext.files = this.cachedContext.files.filter(f => f.path !== change.path)
      } else {
        try {
          const content = await readFile(change.path, 'utf-8')
          const stats = await stat(change.path)
          
          const file: File = {
            path: change.path,
            content,
            size: stats.size,
            lastModified: stats.mtime
          }

          const index = this.cachedContext.files.findIndex(f => f.path === change.path)
          if (index >= 0) {
            this.cachedContext.files[index] = file
          } else {
            this.cachedContext.files.push(file)
          }

          // Re-analyze dependencies for this file
          const deps = await this.dependencyAnalyzer.analyzeFile(file)
          this.cachedContext.dependencies = this.cachedContext.dependencies.filter(
            d => d.from !== change.path
          )
          this.cachedContext.dependencies.push(...deps)
        } catch (error) {
          // File might not exist, skip
        }
      }
    }

    // Update cache
    this.cache.set('main', this.cachedContext)
    await this.cache.save()

    return this.cachedContext
  }

  private async loadFiles(rootDir: string, maxDepth: number = 5, currentDepth: number = 0): Promise<File[]> {
    if (currentDepth > maxDepth) {
      return []
    }

    const files: File[] = []
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md']

    try {
      const entries = await readdir(rootDir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(rootDir, entry.name)

        // Skip node_modules, .git, etc.
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue
        }

        if (entry.isDirectory()) {
          const subFiles = await this.loadFiles(fullPath, maxDepth, currentDepth + 1)
          files.push(...subFiles)
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'))
          if (extensions.includes(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8')
              const stats = await stat(fullPath)
              
              files.push({
                path: fullPath,
                content,
                size: stats.size,
                lastModified: stats.mtime
              })
            } catch (error) {
              // Skip files that can't be read
            }
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }

    return files
  }
}
