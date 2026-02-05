export interface Plan {
  phases: Phase[]
  metadata: {
    generatedAt: string
    intentHash: string
    estimatedDuration: number
    appName?: string // Name of the app (e.g., "password-generator", "todo-app")
  }
}

export interface Phase {
  name: string
  description: string
  steps: Step[]
  dependencies: string[]
}

export interface Step {
  id: string
  description: string
  type: 'create' | 'modify' | 'delete' | 'verify'
  files: string[]
  /** Requirement IDs this step implements (e.g. REQ-001, REQ-002) */
  requirementIds?: string[]
  validation?: ValidationRule[]
  estimatedTime: number
  completed?: boolean
}

export interface ValidationRule {
  type: 'syntax' | 'type' | 'build' | 'rule'
  description: string
}

export interface GeneratedCode {
  filePath: string
  code: string
  explanation?: string
  dependencies?: string[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
