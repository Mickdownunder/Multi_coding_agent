import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

export interface TraceabilityFile {
  path: string
  requirements: string[]
  step: string
}

export interface TraceabilityRequirement {
  files: string[]
  steps: string[]
}

export interface TraceabilityData {
  version: string
  intentHash: string
  requirements: Record<string, TraceabilityRequirement>
  files: Record<string, { requirements: string[]; step: string }>
}

const CONTROL_DIR = join(process.cwd(), 'control')
const TRACEABILITY_FILE = join(CONTROL_DIR, 'traceability.json')

/**
 * Generate traceability header for generated files
 */
export function buildTraceabilityHeader(stepId: string, requirementIds: string[]): string {
  const timestamp = new Date().toISOString()
  const reqList = requirementIds.length > 0 ? requirementIds.join(', ') : 'auto'
  return `/**
 * @intent ${reqList}
 * @generated ${timestamp}
 * @step ${stepId}
 */
`
}

/**
 * Prepend traceability header to file content (for .ts, .tsx, .js, .jsx)
 */
export function prependTraceabilityHeader(
  content: string,
  stepId: string,
  requirementIds: string[]
): string {
  const header = buildTraceabilityHeader(stepId, requirementIds)
  // Avoid duplicate headers
  if (content.trimStart().startsWith('/**') && content.includes('@step')) {
    return content
  }
  return header + content
}

/**
 * Load existing traceability data or create empty
 */
export async function loadTraceability(): Promise<TraceabilityData> {
  try {
    const raw = await readFile(TRACEABILITY_FILE, 'utf-8')
    return JSON.parse(raw) as TraceabilityData
  } catch {
    return {
      version: '1.0',
      intentHash: '',
      requirements: {},
      files: {}
    }
  }
}

/**
 * Update traceability when a file is written
 */
export async function recordFileTraceability(
  intentHash: string,
  filePath: string,
  stepId: string,
  requirementIds: string[]
): Promise<void> {
  const data = await loadTraceability()
  data.intentHash = intentHash
  data.files[filePath] = { requirements: requirementIds, step: stepId }

  for (const reqId of requirementIds) {
    if (!data.requirements[reqId]) {
      data.requirements[reqId] = { files: [], steps: [] }
    }
    if (!data.requirements[reqId].files.includes(filePath)) {
      data.requirements[reqId].files.push(filePath)
    }
    if (!data.requirements[reqId].steps.includes(stepId)) {
      data.requirements[reqId].steps.push(stepId)
    }
  }

  await writeFile(TRACEABILITY_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Merge traceability from a step (multiple files)
 */
export async function mergeStepTraceability(
  intentHash: string,
  files: Array<{ path: string }>,
  stepId: string,
  requirementIds: string[]
): Promise<void> {
  const data = await loadTraceability()
  data.intentHash = intentHash

  for (const f of files) {
    data.files[f.path] = { requirements: requirementIds, step: stepId }
    for (const reqId of requirementIds) {
      if (!data.requirements[reqId]) {
        data.requirements[reqId] = { files: [], steps: [] }
      }
      if (!data.requirements[reqId].files.includes(f.path)) {
        data.requirements[reqId].files.push(f.path)
      }
      if (!data.requirements[reqId].steps.includes(stepId)) {
        data.requirements[reqId].steps.push(stepId)
      }
    }
  }

  await writeFile(TRACEABILITY_FILE, JSON.stringify(data, null, 2), 'utf-8')
}
