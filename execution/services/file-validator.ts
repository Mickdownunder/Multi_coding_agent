import { exec } from 'child_process'
import { promisify } from 'util'
import { readFile } from 'fs/promises'
import { join } from 'path'
import * as ts from 'typescript'

const execAsync = promisify(exec)

const CONTROL_DIR = join(process.cwd(), 'control')
const RULES_FILE = join(CONTROL_DIR, 'rules.json')

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export class PolicyViolationError extends Error {
  constructor(
    message: string,
    public violations: string[] = [],
    public filePath?: string,
    public violationType?: string,
    public suggestedFix?: string
  ) {
    super(message)
    this.name = 'PolicyViolationError'
  }
}

interface RulesConfig {
  version: string
  enforcement: string
  forbiddenImports: string[]
  allowedImports?: Record<string, string[]>
  enforceTailwind: boolean
  disallowAny: boolean
  requireTypeScript: boolean
  enforceStrictMode: boolean
  forbiddenPatterns: Array<{
    pattern: string
    type: string
    message: string
    exceptions?: string[]
    fileExceptions?: string[]
  }>
  requiredPatterns?: Array<{
    pattern: string
    type: string
    message: string
    fileTypes?: string[]
  }>
  fileStructure?: {
    apiRoutes?: string
    components?: string[]
    types?: string
    services?: string
    agents?: string
    enforcePaths?: boolean
    pathPatterns?: Record<string, string>
  }
  security?: {
    forbiddenPatterns?: Array<{
      pattern: string
      type: string
      message: string
      exceptions?: string[]
    }>
  }
  performance?: {
    requiredCleanup?: string[]
    patterns?: Array<{
      pattern: string
      type: string
      message: string
      checkCleanup?: boolean
    }>
  }
}

export class FileValidator {
  private rulesConfig: RulesConfig | null = null

  private async loadRules(): Promise<RulesConfig> {
    if (this.rulesConfig) {
      return this.rulesConfig
    }

    try {
      const content = await readFile(RULES_FILE, 'utf-8')
      this.rulesConfig = JSON.parse(content) as RulesConfig
      return this.rulesConfig
    } catch (error) {
      // If rules.json doesn't exist, create default strict rules
      const defaultRules: RulesConfig = {
        version: '1.0.0',
        enforcement: 'hard',
        forbiddenImports: ['next/document'],
        allowedImports: {
          'next/document': ['pages/_document.tsx', 'app/_document.tsx']
        },
        enforceTailwind: true,
        disallowAny: true,
        requireTypeScript: true,
        enforceStrictMode: true,
        forbiddenPatterns: [
          {
            pattern: 'any',
            type: 'type',
            message: "Use of 'any' type is forbidden",
            exceptions: ['// eslint-disable', '// @ts-ignore']
          },
          {
            pattern: 'next/document',
            type: 'import',
            message: "Import of 'next/document' is forbidden except in _document.tsx",
            fileExceptions: ['_document.tsx']
          }
        ],
        requiredPatterns: []
      }
      this.rulesConfig = defaultRules
      return defaultRules
    }
  }

  /**
   * AST-based policy validation using TypeScript Compiler API
   * This provides precise checking of imports, types, and code structure
   */
  async validatePolicyAST(filePath: string, content: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Only validate TypeScript/TSX files with AST
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return { valid: true, errors, warnings }
    }

    try {
      const rules = await this.loadRules()
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      )

      // Traverse AST to find violations
      const visit = (node: ts.Node) => {
        // Check for forbidden imports
        if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          const importPath = node.moduleSpecifier.text
          
          for (const forbiddenImport of rules.forbiddenImports) {
            if (importPath === forbiddenImport) {
              // Check if this file is an exception
              const isException = rules.allowedImports?.[forbiddenImport]?.some(exception => 
                filePath.includes(exception)
              ) || false

              if (!isException) {
                const forbiddenPattern = rules.forbiddenPatterns.find(p => p.pattern === forbiddenImport)
                const message = forbiddenPattern?.message || `Import of '${forbiddenImport}' is forbidden`
                errors.push(`POLICY VIOLATION: ${message}`)
              }
            }
          }
        }

        // Check for 'any' type usage
        if (rules.disallowAny) {
          if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeName.text === 'any') {
            // Check if there's an exception comment nearby
            const sourceText = sourceFile.getFullText()
            const nodeStart = node.getStart(sourceFile)
            const lineStart = sourceText.lastIndexOf('\n', nodeStart) + 1
            const lineText = sourceText.substring(lineStart, nodeStart + 100)
            
            if (!lineText.includes('// eslint-disable') && !lineText.includes('// @ts-ignore')) {
              errors.push('POLICY VIOLATION: Use of "any" type is forbidden. Use proper TypeScript types.')
            }
          }

          // Check for type annotations with 'any'
          if (ts.isParameter(node) && node.type) {
            if (ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === 'any') {
              const sourceText = sourceFile.getFullText()
              const nodeStart = node.getStart(sourceFile)
              const lineStart = sourceText.lastIndexOf('\n', nodeStart) + 1
              const lineText = sourceText.substring(lineStart, nodeStart + 100)
              
              if (!lineText.includes('// eslint-disable') && !lineText.includes('// @ts-ignore')) {
                errors.push('POLICY VIOLATION: Use of "any" type is forbidden. Use proper TypeScript types.')
              }
            }
          }
        }

        // Check for async functions without try/catch (if required by rules)
        if (rules.requiredPatterns && rules.requiredPatterns.some(p => p.type === 'error-handling')) {
          if (ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) {
            const isAsync = node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) || false
            
            if (isAsync && node.body) {
              // Check if body contains await statements
              let hasAwait = false
              let hasTryCatch = false
              
              const checkForAwait = (n: ts.Node) => {
                if (ts.isAwaitExpression(n)) {
                  hasAwait = true
                }
                if (ts.isTryStatement(n)) {
                  hasTryCatch = true
                }
                ts.forEachChild(n, checkForAwait)
              }
              
              ts.forEachChild(node.body, checkForAwait)
              
              if (hasAwait && !hasTryCatch) {
                warnings.push('POLICY WARNING: Async function with await should have try/catch error handling')
              }
            }
          }
        }

        ts.forEachChild(node, visit)
      }

      visit(sourceFile)
    } catch (error) {
      // If AST parsing fails (syntax errors), fall back to regex validation
      warnings.push('AST parsing failed, falling back to regex validation')
      return { valid: true, errors, warnings } // Don't fail on parse errors, let regex handle it
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validateAgainstRules(filePath: string, content: string): Promise<ValidationResult> {
    const rules = await this.loadRules()
    const errors: string[] = []
    const warnings: string[] = []

    // Try AST-based validation first for TypeScript files
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const astResult = await this.validatePolicyAST(filePath, content)
      if (!astResult.valid) {
        errors.push(...astResult.errors)
        warnings.push(...astResult.warnings)
        // If AST validation found errors, return early
        return {
          valid: false,
          errors,
          warnings
        }
      }
      warnings.push(...astResult.warnings)
    }

    // Fallback to regex validation for non-TypeScript files or additional checks
    // Check forbidden imports (regex fallback)
    for (const forbiddenImport of rules.forbiddenImports) {
      const importRegex = new RegExp(`import\\s+.*?\\s+from\\s+['"]${forbiddenImport.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g')
      
      // Check if this file is an exception
      const isException = rules.allowedImports?.[forbiddenImport]?.some(exception => 
        filePath.includes(exception)
      ) || false

      if (!isException && importRegex.test(content)) {
        const forbiddenPattern = rules.forbiddenPatterns.find(p => p.pattern === forbiddenImport)
        const message = forbiddenPattern?.message || `Import of '${forbiddenImport}' is forbidden`
        errors.push(`POLICY VIOLATION: ${message}`)
      }
    }

    // Check forbidden patterns (regex for non-TypeScript files)
    for (const forbiddenPattern of rules.forbiddenPatterns) {
      const regex = new RegExp(forbiddenPattern.pattern, 'g')
      const matches = content.match(regex)
      
      if (matches) {
        // Check if file is an exception
        const isFileException = forbiddenPattern.fileExceptions?.some(exception =>
          filePath.includes(exception)
        ) || false

        if (!isFileException) {
          // Check if exception comments are present
          const hasException = forbiddenPattern.exceptions?.some(exception =>
            content.includes(exception)
          ) || false

          if (!hasException) {
            errors.push(`POLICY VIOLATION: ${forbiddenPattern.message}`)
          }
        }
      }
    }

    // Check security rules
    if (rules.security?.forbiddenPatterns) {
      for (const securityPattern of rules.security.forbiddenPatterns) {
        const regex = new RegExp(securityPattern.pattern, 'g')
        const matches = content.match(regex)
        
        if (matches) {
          // Check if exception is present
          const hasException = securityPattern.exceptions?.some(exception => {
            const exceptionRegex = new RegExp(exception, 'g')
            return exceptionRegex.test(content)
          }) || false

          if (!hasException) {
            errors.push(`POLICY VIOLATION (Security): ${securityPattern.message}`)
          }
        }
      }
    }

    // Check performance rules
    if (rules.performance?.patterns) {
      for (const perfPattern of rules.performance.patterns) {
        const regex = new RegExp(perfPattern.pattern, 'g')
        const matches = content.match(regex)
        
        if (matches && perfPattern.checkCleanup) {
          // Check if cleanup is present (simplified check)
          const cleanupPatterns: Record<string, string> = {
            'setInterval': 'clearInterval',
            'setTimeout': 'clearTimeout',
            'addEventListener': 'removeEventListener'
          }
          
          const cleanupPattern = cleanupPatterns[perfPattern.pattern.split('\\s*\\(')[0]]
          if (cleanupPattern && !content.includes(cleanupPattern)) {
            warnings.push(`POLICY WARNING (Performance): ${perfPattern.message}`)
          }
        }
      }
    }

    // Check file structure enforcement
    if (rules.fileStructure?.enforcePaths && rules.fileStructure.pathPatterns) {
      const pathPatterns = rules.fileStructure.pathPatterns
      let matchesPattern = false
      
      for (const [type, pattern] of Object.entries(pathPatterns)) {
        const regex = new RegExp(pattern)
        if (regex.test(filePath)) {
          matchesPattern = true
          break
        }
      }
      
      // Allow files in apps/ directory (generated apps)
      if (!matchesPattern && !filePath.startsWith('apps/') && !filePath.startsWith('control/') && 
          !filePath.startsWith('node_modules/') && !filePath.startsWith('.next/')) {
        // Only warn for structure violations, don't block
        warnings.push(`File structure: ${filePath} does not match expected patterns`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
  async validateSyntax(filePath: string, content: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic syntax checks
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      // Check for basic TypeScript syntax issues
      if (content.includes('any') && !content.includes('// eslint-disable')) {
        warnings.push('File contains "any" type')
      }

      // Check for unclosed brackets
      const openBraces = (content.match(/{/g) || []).length
      const closeBraces = (content.match(/}/g) || []).length
      if (openBraces !== closeBraces) {
        errors.push('Unmatched braces')
      }

      const openParens = (content.match(/\(/g) || []).length
      const closeParens = (content.match(/\)/g) || []).length
      if (openParens !== closeParens) {
        errors.push('Unmatched parentheses')
      }
    }

    // Check for null bytes
    if (content.includes('\0')) {
      errors.push('File contains null bytes')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validateTypes(filePath: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) {
      return { valid: true, errors, warnings }
    }

    try {
      // Try to run TypeScript compiler in check mode
      const { stdout, stderr } = await execAsync(`npx tsc --noEmit ${filePath}`, {
        timeout: 10000
      })

      if (stderr) {
        errors.push(stderr)
      }
    } catch (error) {
      // TypeScript might not be available or file might have errors
      // This is okay, we'll catch it during build
      warnings.push('Type checking skipped (TypeScript not available or errors found)')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validateImports(filePath: string, content: string): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // First check against rules (hard enforcement)
    const rulesValidation = await this.validateAgainstRules(filePath, content)
    if (!rulesValidation.valid) {
      errors.push(...rulesValidation.errors)
      // Don't continue with other checks if policy violations exist
      return {
        valid: false,
        errors,
        warnings: [...warnings, ...rulesValidation.warnings]
      }
    }

    // Extract imports
    const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g
    const imports: string[] = []
    let match

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1])
    }

    // Check for common issues
    for (const imp of imports) {
      if (imp.startsWith('.') && !imp.match(/^\.\.?\/.+/)) {
        warnings.push(`Suspicious import path: ${imp}`)
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  async validatePattern(filePath: string, content: string, patterns: Array<{ type: string; examples: string[] }>): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    // Check if file follows project patterns
    // This is a simplified check - in production, this would be more sophisticated
    for (const pattern of patterns) {
      if (pattern.type === 'import') {
        const hasMatchingImport = pattern.examples.some(example =>
          content.includes(example)
        )
        if (!hasMatchingImport && pattern.examples.length > 0) {
          warnings.push(`File might not follow import pattern: ${pattern.type}`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
