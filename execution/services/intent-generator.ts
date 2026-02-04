import { LLMService } from './llm-service'
import { TokenBudgetService } from './token-budget-service'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const INTENT_FILE = join(CONTROL_DIR, 'intent.md')
const RULES_FILE = join(CONTROL_DIR, 'rules.md')

export interface IntentStructure {
  goal: string
  requirements: string[]
  constraints?: string[]
  successCriteria?: string[]
  examples?: string[]
}

export class IntentGenerator {
  private llmService: LLMService
  private tokenBudget: TokenBudgetService

  constructor() {
    this.llmService = new LLMService()
    this.tokenBudget = new TokenBudgetService()
  }

  async generateFromChat(chatHistory: Array<{ role: string; content: string }>): Promise<{
    intent: IntentStructure
    cost: number
  }> {
    // Analyze chat conversation
    const conversation = chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')
    
    // Use LLM to extract intent
    const response = await this.llmService.chatWithUser(
      `Based on our conversation, generate a structured intent with goal, requirements, constraints, and success criteria.`,
      chatHistory
    )

    // Parse response
    let intent: IntentStructure
    if (typeof response === 'object' && 'suggestedIntent' in response && response.suggestedIntent) {
      intent = response.suggestedIntent as IntentStructure
    } else {
      // Fallback: extract from conversation
      intent = this.extractIntentFromConversation(conversation)
    }

    // Get cost estimate
    const costEstimate = await this.tokenBudget.getCostEstimate()

    return {
      intent,
      cost: costEstimate.totalCost
    }
  }

  async writeIntent(intent: IntentStructure): Promise<void> {
    const markdown = this.intentToMarkdown(intent)
    await writeFile(INTENT_FILE, markdown, 'utf-8')
  }

  async validateIntent(intent: IntentStructure): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!intent.goal || intent.goal.trim().length === 0) {
      errors.push('Goal is required')
    }

    if (!intent.requirements || intent.requirements.length === 0) {
      errors.push('At least one requirement is needed')
    }

    // Read rules to validate against
    try {
      const rules = await readFile(RULES_FILE, 'utf-8')
      // Check if intent violates any rules
      // This is simplified - in production, would parse rules properly
    } catch {
      warnings.push('Could not read rules.md for validation')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  private extractIntentFromConversation(conversation: string): IntentStructure {
    // Simple extraction - in production, would use LLM
    const lines = conversation.split('\n')
    const goal = lines.find(l => l.toLowerCase().includes('goal') || l.toLowerCase().includes('want')) || ''
    const requirements: string[] = []
    const constraints: string[] = []

    for (const line of lines) {
      if (line.toLowerCase().includes('need') || line.toLowerCase().includes('require')) {
        requirements.push(line)
      }
      if (line.toLowerCase().includes('constraint') || line.toLowerCase().includes('limit')) {
        constraints.push(line)
      }
    }

    return {
      goal: goal.substring(goal.indexOf(':') + 1).trim(),
      requirements,
      constraints,
      successCriteria: []
    }
  }

  private intentToMarkdown(intent: IntentStructure): string {
    let markdown = `# Intent\n\n`
    markdown += `## Goal\n\n${intent.goal}\n\n`
    
    if (intent.requirements && intent.requirements.length > 0) {
      markdown += `## Requirements\n\n`
      for (const req of intent.requirements) {
        markdown += `- ${req}\n`
      }
      markdown += `\n`
    }

    if (intent.constraints && intent.constraints.length > 0) {
      markdown += `## Constraints\n\n`
      for (const constraint of intent.constraints) {
        markdown += `- ${constraint}\n`
      }
      markdown += `\n`
    }

    if (intent.successCriteria && intent.successCriteria.length > 0) {
      markdown += `## Success Criteria\n\n`
      for (const criterion of intent.successCriteria) {
        markdown += `- ${criterion}\n`
      }
      markdown += `\n`
    }

    return markdown
  }
}
