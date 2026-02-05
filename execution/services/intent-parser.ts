import { readFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'

export interface ParsedRequirement {
  id: string
  description: string
  priority?: 'low' | 'medium' | 'high'
}

export interface ParsedIntent {
  /** Structured requirements from frontmatter or auto-extracted */
  requirements: ParsedRequirement[]
  /** Raw markdown body (content after frontmatter) */
  body: string
  /** Hash of full intent for change detection */
  hash: string
  /** Whether intent has structured frontmatter */
  hasStructuredSchema: boolean
}

const CONTROL_DIR = join(process.cwd(), 'control')
const INTENT_FILE = join(CONTROL_DIR, 'intent.md')

/**
 * Parse YAML frontmatter requirements block.
 * Handles format:
 * requirements:
 *   - id: REQ-001
 *     description: "..."
 *     priority: high
 */
function parseFrontmatterRequirements(yamlBlock: string): ParsedRequirement[] {
  const requirements: ParsedRequirement[] = []
  const lines = yamlBlock.split('\n')
  let inRequirements = false
  let currentReq: Partial<ParsedRequirement> | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('requirements:')) {
      inRequirements = true
      continue
    }
    if (!inRequirements) continue

    const dashMatch = trimmed.match(/^-\s+id:\s*(REQ-\d+)/)
    if (dashMatch) {
      if (currentReq && currentReq.id) {
        requirements.push(currentReq as ParsedRequirement)
      }
      currentReq = { id: dashMatch[1], description: '' }
      const descMatch = trimmed.match(/description:\s*["']?([^"'\n]+)["']?/)
      if (descMatch) currentReq.description = descMatch[1].trim()
      continue
    }

    if (currentReq && trimmed.startsWith('description:')) {
      const m = trimmed.match(/description:\s*["']?([^"'\n]+)["']?/)
      if (m) currentReq.description = m[1].trim()
      continue
    }
    if (currentReq && trimmed.startsWith('priority:')) {
      const m = trimmed.match(/priority:\s*(low|medium|high)/i)
      if (m) currentReq.priority = m[1].toLowerCase() as 'low' | 'medium' | 'high'
      continue
    }

    if (trimmed && !trimmed.startsWith('-') && !trimmed.startsWith(' ')) {
      inRequirements = false
    }
  }
  if (currentReq && currentReq.id) {
    requirements.push(currentReq as ParsedRequirement)
  }
  return requirements
}

/**
 * Extract requirements from markdown ## Requirements section when no frontmatter.
 * Auto-assigns REQ-001, REQ-002, etc. to list items.
 */
function extractRequirementsFromMarkdown(body: string): ParsedRequirement[] {
  const requirements: ParsedRequirement[] = []
  const reqSectionMatch = body.match(/##\s*Requirements\s*\n([\s\S]*?)(?=\n##|$)/i)
  if (!reqSectionMatch) return requirements

  const section = reqSectionMatch[1]
  const listItems = section.split('\n').filter(line => /^\s*[-*]\s+/.test(line))
  listItems.forEach((item, i) => {
    const desc = item.replace(/^\s*[-*]\s+/, '').trim()
    if (desc) {
      requirements.push({
        id: `REQ-${String(i + 1).padStart(3, '0')}`,
        description: desc,
        priority: 'medium'
      })
    }
  })
  return requirements
}

/**
 * Parse intent.md with optional YAML frontmatter.
 * Backward compatible: works with plain markdown (auto-extracts requirements).
 */
export async function parseIntent(content?: string): Promise<ParsedIntent> {
  const raw = content ?? await readFile(INTENT_FILE, 'utf-8')
  const hash = createHash('sha256').update(raw).digest('hex').substring(0, 16)

  const frontMatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  let body: string
  let requirements: ParsedRequirement[]
  let hasStructuredSchema: boolean

  if (frontMatterMatch) {
    body = frontMatterMatch[2].trim()
    requirements = parseFrontmatterRequirements(frontMatterMatch[1])
    hasStructuredSchema = requirements.length > 0
  } else {
    body = raw.trim()
    requirements = extractRequirementsFromMarkdown(body)
    hasStructuredSchema = false
  }

  return {
    requirements,
    body,
    hash,
    hasStructuredSchema
  }
}

/**
 * Compute delta between two parsed intents (for incremental execution).
 */
export function computeIntentDelta(
  oldIntent: ParsedIntent,
  newIntent: ParsedIntent
): { added: string[]; removed: string[]; changed: string[] } {
  const oldIds = new Set(oldIntent.requirements.map(r => r.id))
  const newIds = new Set(newIntent.requirements.map(r => r.id))
  const oldMap = new Map(oldIntent.requirements.map(r => [r.id, r]))
  const newMap = new Map(newIntent.requirements.map(r => [r.id, r]))

  const added = [...newIds].filter(id => !oldIds.has(id))
  const removed = [...oldIds].filter(id => !newIds.has(id))
  const changed = [...newIds]
    .filter(id => oldIds.has(id))
    .filter(id => {
      const o = oldMap.get(id)
      const n = newMap.get(id)
      return o && n && o.description !== n.description
    })

  return { added, removed, changed }
}
