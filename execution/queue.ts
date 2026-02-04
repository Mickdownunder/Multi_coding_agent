import { Execution } from './types/agent'

export interface QueuedItem {
  id: string
  state: string
  priority: number
  timestamp: Date
  retries: number
}

export class ExecutionQueue {
  private queue: QueuedItem[] = []
  private processing = false

  enqueue(state: string, priority: number = 0): string {
    const id = `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const item: QueuedItem = {
      id,
      state,
      priority,
      timestamp: new Date(),
      retries: 0
    }
    
    this.queue.push(item)
    // Sort by priority (higher first), then by timestamp
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.timestamp.getTime() - b.timestamp.getTime()
    })
    
    return id
  }

  dequeue(): QueuedItem | null {
    if (this.queue.length === 0) {
      return null
    }
    return this.queue.shift() || null
  }

  peek(): QueuedItem | null {
    if (this.queue.length === 0) {
      return null
    }
    return this.queue[0]
  }

  isEmpty(): boolean {
    return this.queue.length === 0
  }

  size(): number {
    return this.queue.length
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id)
    if (index !== -1) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  incrementRetries(id: string): void {
    const item = this.queue.find(item => item.id === id)
    if (item) {
      item.retries++
    }
  }

  clear(): void {
    this.queue = []
  }

  setProcessing(processing: boolean): void {
    this.processing = processing
  }

  isProcessing(): boolean {
    return this.processing
  }
}
