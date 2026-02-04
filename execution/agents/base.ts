import { ContextManager } from '../services/context-manager'
import { FileService } from '../services/file-service'
import { GitService } from '../services/git-service'
import { LLMService } from '../services/llm-service'
import { readFile } from 'fs/promises'
import { join } from 'path'

const CONTROL_DIR = join(process.cwd(), 'control')
const QUESTIONS_FILE = join(CONTROL_DIR, 'questions.md')

export abstract class Agent {
  protected context: ContextManager
  protected fileService: FileService
  protected gitService: GitService
  protected llmService: LLMService

  constructor(
    context: ContextManager,
    fileService: FileService,
    gitService: GitService,
    llmService: LLMService
  ) {
    this.context = context
    this.fileService = fileService
    this.gitService = gitService
    this.llmService = llmService
  }

  abstract onEnter(): Promise<void>
  abstract execute(): Promise<void>
  abstract onExit(): Promise<void>
  abstract validate(): Promise<boolean>

  protected async checkQuestions(): Promise<void> {
    try {
      const content = await readFile(QUESTIONS_FILE, 'utf-8')
      const pendingQuestions = this.parsePendingQuestions(content)
      
      if (pendingQuestions.length > 0) {
        // Pause execution until questions are answered
        await this.pause()
      }
    } catch (error) {
      // Questions file doesn't exist or can't be read, continue
    }
  }

  protected async pause(): Promise<void> {
    // Wait for questions to be answered
    // Check every 2 seconds
    while (true) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      try {
        const content = await readFile(QUESTIONS_FILE, 'utf-8')
        const pendingQuestions = this.parsePendingQuestions(content)
        
        if (pendingQuestions.length === 0) {
          break // All questions answered
        }
      } catch (error) {
        // File doesn't exist, continue
        break
      }
    }
  }

  protected async log(message: string): Promise<void> {
    const logFile = join(CONTROL_DIR, 'execution.log')
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] [${this.constructor.name}] ${message}\n`
    
    try {
      const { appendFile } = await import('fs/promises')
      await appendFile(logFile, logEntry, 'utf-8')
    } catch (error) {
      console.error('Failed to write to log:', error)
    }
  }

  private parsePendingQuestions(content: string): string[] {
    const lines = content.split('\n')
    const questions: string[] = []
    let inQuestion = false
    let currentQuestion = ''

    for (const line of lines) {
      if (line.match(/^\[.*\]\s+\[.*\]\s+Question:/)) {
        if (currentQuestion) {
          questions.push(currentQuestion.trim())
        }
        currentQuestion = line
        inQuestion = true
      } else if (inQuestion && line.match(/^\[USER\]/)) {
        // Question answered
        inQuestion = false
        currentQuestion = ''
      } else if (inQuestion) {
        currentQuestion += '\n' + line
      }
    }

    if (currentQuestion) {
      questions.push(currentQuestion.trim())
    }

    return questions
  }
}
