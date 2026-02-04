export interface File {
  path: string
  content: string
  size: number
  lastModified: Date
}

export interface Codebase {
  files: File[]
  structure: ProjectStructure
}

export interface ProjectStructure {
  root: string
  files: string[]
  directories: string[]
}

export interface Context {
  files: File[]
  dependencies: Dependency[]
  patterns: CodePattern[]
}

export interface Dependency {
  from: string
  to: string
  type: 'import' | 'export' | 'reference'
}

export interface CodePattern {
  type: string
  description: string
  examples: string[]
}

export interface ContextSnapshot {
  timestamp: Date
  context: Context
  hash: string
}
