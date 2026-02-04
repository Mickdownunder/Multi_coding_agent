import { ConfigService } from './config-service'
import { TokenBudgetService, BudgetExceededError } from './token-budget-service'
import { ModelSelector, Task } from './model-selector'

interface LLMResponse {
  content: string
  tokensUsed: number
  model: string
}

export class LLMService {
  private configService: ConfigService
  private tokenBudget: TokenBudgetService
  private modelSelector: ModelSelector
  private rateLimitQueue: Array<() => void> = []
  private processingRateLimit = false

  constructor() {
    this.configService = new ConfigService()
    this.tokenBudget = new TokenBudgetService()
    this.modelSelector = new ModelSelector()
  }

  async generatePlan(request: {
    intent: string
    rules: string
    context?: unknown
  }): Promise<{
    plan: {
      phases: Array<{
        name: string
        description: string
        steps: Array<{
          id: string
          description: string
          type: string
          files: string[]
        }>
      }>
    }
  }> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    
    // HARD ENFORCEMENT: Check budget before LLM call
    await this.tokenBudget.enforceBudget()
    
    const task: Task = {
      type: 'plan',
      complexity: 'complex',
      description: 'Generate implementation plan'
    }

    const model = await this.modelSelector.selectModel(task)
    const prompt = this.buildPlanPrompt(request)

    const response = await this.callWithRetry(prompt, model, 3, 'plan')
    
    // Parse response as JSON
    try {
      const plan = JSON.parse(response.content)
      await this.tokenBudget.trackUsage(response.tokensUsed, 'plan')
      return { plan }
    } catch (error) {
      throw new Error(`Failed to parse plan response: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async generateCode(request: {
    step: {
      id: string
      description: string
      type: string
      files: string[]
    }
    context: {
      existingFiles: Array<{ path: string; content: string }>
      projectStructure: unknown
      patterns: unknown[]
      dependencies: unknown[]
    }
    constraints: {
      language: string
      framework: string
      style: string
      rules: unknown[]
    }
  }): Promise<{
    code: string
    files: Array<{ path: string; content: string }>
    explanation: string
    dependencies: string[]
  }> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    
    const task: Task = {
      type: 'code',
      complexity: this.determineComplexity(request.step),
      description: request.step.description
    }

    // HARD ENFORCEMENT: Check budget before LLM call
    await this.tokenBudget.enforceBudget()

    const model = await this.modelSelector.selectModel(task)
    const prompt = this.buildCodePrompt(request)

    const response = await this.callWithRetry(prompt, model, 3, 'code')
    
    // Parse response with robust JSON extraction
    try {
      const result = this.extractAndParseJSON(response.content)
      await this.tokenBudget.trackUsage(response.tokensUsed, 'code')
      return result
    } catch (error) {
      // Retry once with a more explicit prompt if JSON parsing fails
      try {
        const retryPrompt = `${prompt}\n\nIMPORTANT: Your response must be valid, complete JSON. Do not truncate the response.`
        const retryResponse = await this.callWithRetry(retryPrompt, model, 1, 'code')
        const result = this.extractAndParseJSON(retryResponse.content)
        await this.tokenBudget.trackUsage(retryResponse.tokensUsed, 'code')
        return result
      } catch (retryError) {
        throw new Error(`Failed to parse code response after retry: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  async chatWithUser(message: string, history: Array<{ role: string; content: string }>): Promise<{
    response: string
    suggestedIntent?: unknown
    questions?: string[]
  }> {
    // Ensure config is loaded
    await this.configService.loadConfig()
    
    // HARD ENFORCEMENT: Check budget before LLM call
    await this.tokenBudget.enforceBudget()
    
    const task: Task = {
      type: 'chat',
      complexity: 'medium',
      description: 'User chat'
    }

    const model = await this.modelSelector.selectModel(task)
    const prompt = this.buildChatPrompt(message, history)

    const response = await this.callWithRetry(prompt, model, 3, 'chat')
    
    await this.tokenBudget.trackUsage(response.tokensUsed, 'chat')
    
    try {
      return JSON.parse(response.content)
    } catch (error) {
      // If not JSON, return as plain text
      return {
        response: response.content,
        questions: []
      }
    }
  }

  private async callWithRetry(
    prompt: string,
    model: string,
    retries: number,
    category: 'plan' | 'code' | 'chat'
  ): Promise<LLMResponse> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Handle rate limiting
        await this.handleRateLimit()

        const response = await this.callLLM(prompt, model)
        return response
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (attempt < retries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    throw lastError || new Error('LLM call failed after retries')
  }

  private async callLLM(prompt: string, model: string): Promise<LLMResponse> {
    const config = this.configService.getLLMConfig()

    // Validate API key before making request
    if (!config.apiKey || config.apiKey.length === 0) {
      throw new Error('LLM API key is not set. Please set OPENAI_API_KEY environment variable or configure in control/config.json')
    }

    // Count tokens (rough estimate: 1 token ≈ 4 characters)
    const inputTokens = Math.ceil(prompt.length / 4)
    const maxOutputTokens = config.maxTokens.output

    // Call OpenAI API
    if (config.provider === 'openai') {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
      
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: 'STRICT JSON ONLY. You are a coding assistant. Respond with ONLY valid JSON. No conversational text, no explanations, no markdown formatting outside the JSON structure. Your response must be parseable JSON.parse() without any preprocessing.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: maxOutputTokens,
            temperature: 0.7
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
          const errorMessage = error.error?.message || 'Unknown error'
          
          // Provide helpful error messages
          if (response.status === 401) {
            throw new Error(`OpenAI API authentication failed. Please check your API key. Error: ${errorMessage}`)
          }
          if (response.status === 429) {
            throw new Error(`OpenAI API rate limit exceeded. Please wait and retry. Error: ${errorMessage}`)
          }
          
          throw new Error(`OpenAI API error (${response.status}): ${errorMessage}`)
        }

        const data = await response.json()
        const content = data.choices[0]?.message?.content || ''
        const tokensUsed = data.usage?.total_tokens || inputTokens + Math.ceil(content.length / 4)

        return {
          content,
          tokensUsed,
          model
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('OpenAI API request timed out after 60 seconds')
        }
        throw error
      }
    }

    // Call Google Gemini API
    if (config.provider === 'gemini') {
      const geminiApiKey = process.env.GEMINI_API_KEY || config.apiKey
      if (!geminiApiKey) {
        throw new Error('Gemini API key is not set. Please set GEMINI_API_KEY environment variable')
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout
      
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
            body: JSON.stringify({
            contents: [{
              parts: [{
                text: `STRICT JSON ONLY. You are a coding assistant. Respond with ONLY valid JSON. No conversational text, no explanations, no markdown formatting outside the JSON structure. Your response must be parseable JSON.parse() without any preprocessing.\n\n${prompt}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: maxOutputTokens,
              temperature: 0.7
            }
          }),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }))
          const errorMessage = error.error?.message || 'Unknown error'
          
          if (response.status === 401 || response.status === 403) {
            throw new Error(`Gemini API authentication failed. Please check your API key. Error: ${errorMessage}`)
          }
          if (response.status === 429) {
            throw new Error(`Gemini API rate limit exceeded. Please wait and retry. Error: ${errorMessage}`)
          }
          
          throw new Error(`Gemini API error (${response.status}): ${errorMessage}`)
        }

        const data = await response.json()
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const tokensUsed = data.usageMetadata?.totalTokenCount || inputTokens + Math.ceil(content.length / 4)

        return {
          content,
          tokensUsed,
          model
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Gemini API request timed out after 60 seconds')
        }
        throw error
      }
    }

    throw new Error(`Unsupported LLM provider: ${config.provider}`)
  }

  private async handleRateLimit(): Promise<void> {
    // Simple rate limiting: max 60 requests per minute
    return new Promise((resolve) => {
      if (this.processingRateLimit) {
        this.rateLimitQueue.push(() => resolve())
        return
      }

      this.processingRateLimit = true
      setTimeout(() => {
        this.processingRateLimit = false
        const next = this.rateLimitQueue.shift()
        if (next) {
          next()
        }
        resolve()
      }, 1000) // 1 request per second max
    })
  }

  private buildPlanPrompt(request: { intent: string; rules: string; context?: unknown }): string {
    return `You are a software planning assistant. Generate a detailed implementation plan based on the following intent and rules.

Intent:
${request.intent}

Rules:
${request.rules}

${request.context ? `Context:\n${JSON.stringify(request.context, null, 2)}` : ''}

Generate a plan with the following JSON structure:
{
  "phases": [
    {
      "name": "Phase name",
      "description": "Phase description",
      "steps": [
        {
          "id": "step-1",
          "description": "Step description",
          "type": "create|modify|delete|verify",
          "files": ["file1.ts", "file2.ts"]
        }
      ],
      "dependencies": []
    }
  ]
}

STRICT JSON ONLY. Respond with ONLY valid JSON. No conversational text, no explanations, no markdown formatting outside the JSON structure. Your response must be parseable by JSON.parse() without any preprocessing.`
  }

  private buildCodePrompt(request: {
    step: { id: string; description: string; type: string; files: string[] }
    context: { existingFiles: Array<{ path: string; content: string }>; projectStructure: unknown; patterns: unknown[]; dependencies: unknown[] }
    constraints: { language: string; framework: string; style: string; rules: unknown[] }
  }): string {
    const existingFiles = request.context.existingFiles.slice(0, 10).map(f => 
      `// File: ${f.path}\n${f.content.substring(0, 5000)}`
    ).join('\n\n')

    return `You are a code generation assistant. Generate code for the following step.

Step: ${request.step.description}
Type: ${request.step.type}
Files: ${request.step.files.join(', ')}

Existing Files (for context):
${existingFiles}

Constraints:
- Language: ${request.constraints.language}
- Framework: ${request.constraints.framework}
- Style: ${request.constraints.style}

Generate code with the following JSON structure:
{
  "code": "// Generated code here",
  "files": [
    {
      "path": "file.ts",
      "content": "// File content"
    }
  ],
  "explanation": "Brief explanation",
  "dependencies": ["dependency1", "dependency2"]
}

STRICT JSON ONLY. Respond with ONLY valid JSON. No conversational text, no explanations, no markdown formatting outside the JSON structure. Your response must be parseable by JSON.parse() without any preprocessing.`
  }

  private buildChatPrompt(message: string, history: Array<{ role: string; content: string }>): string {
    const historyText = history.map(h => `${h.role}: ${h.content}`).join('\n')
    
    return `You are a helpful coding assistant. Help the user brainstorm and refine their project intent.

Conversation history:
${historyText}

User: ${message}

Respond with JSON:
{
  "response": "Your response",
  "suggestedIntent": { "goal": "...", "requirements": [...] },
  "questions": ["question1", "question2"]
}

STRICT JSON ONLY. Respond with ONLY valid JSON. No conversational text, no explanations, no markdown formatting outside the JSON structure. Your response must be parseable by JSON.parse() without any preprocessing.`
  }

  private determineComplexity(step: { description: string; type: string }): 'simple' | 'medium' | 'complex' {
    const desc = step.description.toLowerCase()
    
    if (desc.includes('complex') || desc.includes('advanced') || desc.includes('sophisticated')) {
      return 'complex'
    }
    
    if (desc.includes('simple') || desc.includes('basic') || desc.includes('create file')) {
      return 'simple'
    }
    
    return 'medium'
  }

  /**
   * Extract and parse JSON from LLM response
   * Handles cases where JSON is wrapped in markdown code blocks or has text before/after
   * ROBUST: Finds JSON even if model adds conversational text
   */
  private extractAndParseJSON(content: string): any {
    if (!content || typeof content !== 'string') {
      throw new Error('Invalid content: content must be a non-empty string')
    }

    // Remove markdown code blocks if present
    let jsonContent = content.trim()
    
    // Extract JSON from markdown code blocks (handles ```json or ```)
    const jsonBlockMatch = jsonContent.match(/```(?:json|typescript|javascript)?\s*([\s\S]*?)\s*```/)
    if (jsonBlockMatch) {
      jsonContent = jsonBlockMatch[1].trim()
    }
    
    // Remove any leading conversational text (common pattern: "Here's the JSON:" or similar)
    // Look for the first { or [ which indicates start of JSON
    const firstJsonChar = Math.min(
      jsonContent.indexOf('{') !== -1 ? jsonContent.indexOf('{') : Infinity,
      jsonContent.indexOf('[') !== -1 ? jsonContent.indexOf('[') : Infinity
    )
    
    if (firstJsonChar !== Infinity && firstJsonChar > 0) {
      jsonContent = jsonContent.substring(firstJsonChar)
    }
    
    // Find JSON object/array boundaries (handles nested structures)
    let jsonStart = -1
    let jsonEnd = -1
    let braceCount = 0
    let bracketCount = 0
    let inString = false
    let escapeNext = false
    
    for (let i = 0; i < jsonContent.length; i++) {
      const char = jsonContent[i]
      
      if (escapeNext) {
        escapeNext = false
        continue
      }
      
      if (char === '\\') {
        escapeNext = true
        continue
      }
      
      if (char === '"') {
        inString = !inString
        continue
      }
      
      if (inString) {
        continue
      }
      
      if (char === '{' || char === '[') {
        if (jsonStart === -1) {
          jsonStart = i
        }
        if (char === '{') {
          braceCount++
        } else {
          bracketCount++
        }
      } else if (char === '}' || char === ']') {
        if (char === '}') {
          braceCount--
        } else {
          bracketCount--
        }
        
        // When all braces/brackets are closed, we found the end
        if (braceCount === 0 && bracketCount === 0 && jsonStart !== -1) {
          jsonEnd = i + 1
          break
        }
      }
    }
    
    // Extract the JSON portion
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      jsonContent = jsonContent.substring(jsonStart, jsonEnd)
    } else if (jsonStart !== -1) {
      // Incomplete JSON - try to close it intelligently
      const openBraces = (jsonContent.substring(jsonStart).match(/\{/g) || []).length
      const closeBraces = (jsonContent.substring(jsonStart).match(/\}/g) || []).length
      const missingBraces = openBraces - closeBraces
      
      // Check for incomplete strings
      const lastQuote = jsonContent.lastIndexOf('"')
      const lastOpenBrace = jsonContent.lastIndexOf('{')
      if (lastQuote > lastOpenBrace && !jsonContent.substring(lastQuote).match(/":\s*$/)) {
        // String is incomplete
        jsonContent = jsonContent.substring(jsonStart) + '"'
      }
      
      // Close incomplete objects/arrays
      if (missingBraces > 0) {
        jsonContent = jsonContent.substring(jsonStart) + '}'.repeat(missingBraces)
      } else if (missingBraces < 0) {
        // Too many closing braces - this is likely corrupted
        throw new Error(`JSON structure appears corrupted: ${Math.abs(missingBraces)} too many closing braces`)
      }
    } else {
      // No JSON structure found at all
      throw new Error(`No valid JSON structure found in response. Content starts with: ${content.substring(0, 100)}...`)
    }
    
    // Final parse attempt
    try {
      const parsed = JSON.parse(jsonContent)
      // Verify it's actually an object or array (not null, string, number, etc.)
      if (parsed === null || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
        throw new Error('Parsed JSON is not an object or array')
      }
      return parsed
    } catch (error) {
      // Provide detailed error with context
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      const preview = jsonContent.length > 500 ? jsonContent.substring(0, 500) + '...' : jsonContent
      throw new Error(`Failed to parse JSON: ${errorMsg}. Extracted JSON preview: ${preview}`)
    }
  }
}
