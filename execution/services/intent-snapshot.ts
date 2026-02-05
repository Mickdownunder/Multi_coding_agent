import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import type { ParsedRequirement } from './intent-parser'

const CONTROL_DIR = join(process.cwd(), 'control')
const SNAPSHOT_FILE = join(CONTROL_DIR, 'intent-snapshot.json')

export interface IntentSnapshot {
  intentHash: string
  requirements: ParsedRequirement[]
  capturedAt: string
}

export async function saveIntentSnapshot(hash: string, requirements: ParsedRequirement[]): Promise<void> {
  const snapshot: IntentSnapshot = {
    intentHash: hash,
    requirements,
    capturedAt: new Date().toISOString()
  }
  await writeFile(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), 'utf-8')
}

export async function loadIntentSnapshot(): Promise<IntentSnapshot | null> {
  try {
    const raw = await readFile(SNAPSHOT_FILE, 'utf-8')
    return JSON.parse(raw) as IntentSnapshot
  } catch {
    return null
  }
}
