import { appendFile, mkdir } from 'fs/promises'
import { join } from 'path'

const LOG_DIR = join(process.cwd(), 'control', 'logs')
const LOG_FILE = join(LOG_DIR, 'execution.log')

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  async log(level: LogLevel, message: string, context?: Record<string, unknown>): Promise<void> {
    if (this.shouldLog(level)) {
      await this.writeLog(level, message, context)
    }
  }

  async debug(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, context)
  }

  async info(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.INFO, message, context)
  }

  async warn(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.WARN, message, context)
  }

  async error(message: string, context?: Record<string, unknown>): Promise<void> {
    await this.log(LogLevel.ERROR, message, context)
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const currentIndex = levels.indexOf(this.logLevel)
    const messageIndex = levels.indexOf(level)
    return messageIndex >= currentIndex
  }

  private async writeLog(level: LogLevel, message: string, context?: Record<string, unknown>): Promise<void> {
    try {
      // Ensure log directory exists
      await mkdir(LOG_DIR, { recursive: true })

      const timestamp = new Date().toISOString()
      const contextStr = context ? ` ${JSON.stringify(context)}` : ''
      const logEntry = `[${timestamp}] [${level}] ${message}${contextStr}\n`

      await appendFile(LOG_FILE, logEntry, 'utf-8')
    } catch (error) {
      console.error('Failed to write log:', error)
    }
  }
}
