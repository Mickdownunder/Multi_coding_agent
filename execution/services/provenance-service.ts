import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { parseIntent } from './intent-parser'
import { loadTraceability } from './traceability-service'
import { Config } from '../config'

const CONTROL_DIR = join(process.cwd(), 'control')
const PROVENANCE_FILE = join(CONTROL_DIR, 'execution-provenance.json')
const PROGRESS_FILE = join(CONTROL_DIR, 'progress.json')

export interface ExecutionProvenance {
  executionId: string
  startedAt: string
  completedAt: string
  state: string
  intentHash: string
  model: string
  stepsExecuted: string[]
  filesModified: string[]
  traceabilityFile: string
}

/**
 * Record execution provenance when an agent completes
 */
export async function recordProvenance(
  executionId: string,
  startedAt: Date,
  completedAt: Date,
  state: string
): Promise<void> {
  let intentHash = ''
  let stepsExecuted: string[] = []
  let filesModified: string[] = []
  let model = 'unknown'

  try {
    const parsed = await parseIntent()
    intentHash = parsed.hash
  } catch {
    // Ignore
  }

  try {
    const progressRaw = await readFile(PROGRESS_FILE, 'utf-8')
    const progress = JSON.parse(progressRaw) as { completedSteps?: string[] }
    stepsExecuted = progress.completedSteps || []
  } catch {
    // Ignore
  }

  try {
    const trace = await loadTraceability()
    filesModified = Object.keys(trace.files)
  } catch {
    // Ignore
  }

  try {
    const config = Config.getInstance()
    await config.load()
    model = config.getLLMConfig().model?.code || config.getLLMConfig().model?.plan || 'unknown'
  } catch {
    // Ignore
  }

  const provenance: ExecutionProvenance = {
    executionId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    state,
    intentHash,
    model,
    stepsExecuted,
    filesModified,
    traceabilityFile: 'control/traceability.json'
  }

  await writeFile(PROVENANCE_FILE, JSON.stringify(provenance, null, 2), 'utf-8')
}
