import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { State } from '../types/agent'

const CONTROL_DIR = join(process.cwd(), 'control')
const CHECKPOINT_DIR = join(CONTROL_DIR, 'checkpoints')

export interface Checkpoint {
  id: string
  timestamp: Date
  state: State
  gitCommit?: string
  planProgress?: {
    completedSteps: number
    totalSteps: number
  }
  metadata?: Record<string, unknown>
}

export class CheckpointService {
  async createCheckpoint(
    state: State,
    gitCommit?: string,
    planProgress?: { completedSteps: number; totalSteps: number }
  ): Promise<string> {
    const id = `checkpoint-${Date.now()}`
    const checkpoint: Checkpoint = {
      id,
      timestamp: new Date(),
      state,
      gitCommit,
      planProgress,
      metadata: {}
    }

    const checkpointFile = join(CHECKPOINT_DIR, `${id}.json`)
    
    // Ensure checkpoint directory exists
    try {
      await writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf-8')
    } catch (error) {
      // If directory doesn't exist, create it
      const { mkdir } = await import('fs/promises')
      await mkdir(CHECKPOINT_DIR, { recursive: true })
      await writeFile(checkpointFile, JSON.stringify(checkpoint, null, 2), 'utf-8')
    }

    // Update latest checkpoint reference
    const latestFile = join(CHECKPOINT_DIR, 'latest.json')
    await writeFile(latestFile, JSON.stringify({ id, timestamp: checkpoint.timestamp }, null, 2), 'utf-8')

    return id
  }

  async getCheckpoint(id: string): Promise<Checkpoint | null> {
    try {
      const checkpointFile = join(CHECKPOINT_DIR, `${id}.json`)
      const content = await readFile(checkpointFile, 'utf-8')
      const checkpoint = JSON.parse(content) as Checkpoint
      checkpoint.timestamp = new Date(checkpoint.timestamp)
      return checkpoint
    } catch (error) {
      return null
    }
  }

  async getLatestCheckpoint(): Promise<Checkpoint | null> {
    try {
      const latestFile = join(CHECKPOINT_DIR, 'latest.json')
      const content = await readFile(latestFile, 'utf-8')
      const { id } = JSON.parse(content) as { id: string }
      return await this.getCheckpoint(id)
    } catch (error) {
      return null
    }
  }

  async listCheckpoints(): Promise<Checkpoint[]> {
    try {
      const { readdir } = await import('fs/promises')
      const files = await readdir(CHECKPOINT_DIR)
      const checkpointFiles = files.filter(f => f.endsWith('.json') && f !== 'latest.json')
      
      const checkpoints: Checkpoint[] = []
      for (const file of checkpointFiles) {
        const id = file.replace('.json', '')
        const checkpoint = await this.getCheckpoint(id)
        if (checkpoint) {
          checkpoints.push(checkpoint)
        }
      }
      
      return checkpoints.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    } catch (error) {
      return []
    }
  }
}
