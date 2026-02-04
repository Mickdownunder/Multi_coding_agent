import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { ContextSnapshot, Context } from '../types/context'
import { createHash } from 'crypto'

const CACHE_DIR = join(process.cwd(), 'control', '.cache')
const CACHE_FILE = join(CACHE_DIR, 'context-cache.json')

export class ContextCache {
  private cache: Map<string, ContextSnapshot> = new Map()

  async load(): Promise<void> {
    try {
      const content = await readFile(CACHE_FILE, 'utf-8')
      const data = JSON.parse(content) as Record<string, ContextSnapshot>
      
      for (const [key, snapshot] of Object.entries(data)) {
        this.cache.set(key, {
          ...snapshot,
          timestamp: new Date(snapshot.timestamp),
          context: {
            ...snapshot.context,
            files: snapshot.context.files.map(f => ({
              ...f,
              lastModified: new Date(f.lastModified)
            }))
          }
        })
      }
    } catch (error) {
      // Cache doesn't exist, start fresh
      this.cache = new Map()
    }
  }

  async save(): Promise<void> {
    try {
      // Ensure cache directory exists
      const { mkdir } = await import('fs/promises')
      await mkdir(CACHE_DIR, { recursive: true })
      
      const data: Record<string, ContextSnapshot> = {}
      for (const [key, snapshot] of this.cache.entries()) {
        data[key] = snapshot
      }
      
      await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save context cache:', error)
    }
  }

  get(key: string): ContextSnapshot | undefined {
    return this.cache.get(key)
  }

  set(key: string, context: Context): void {
    const hash = this.computeHash(context)
    const snapshot: ContextSnapshot = {
      timestamp: new Date(),
      context,
      hash
    }
    this.cache.set(key, snapshot)
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private computeHash(context: Context): string {
    const data = JSON.stringify({
      files: context.files.map(f => ({ path: f.path, size: f.size })),
      dependencies: context.dependencies
    })
    return createHash('sha256').update(data).digest('hex').substring(0, 16)
  }

  async isStale(key: string, maxAge: number = 3600000): Promise<boolean> {
    const snapshot = this.cache.get(key)
    if (!snapshot) {
      return true
    }

    const age = Date.now() - snapshot.timestamp.getTime()
    return age > maxAge
  }
}
