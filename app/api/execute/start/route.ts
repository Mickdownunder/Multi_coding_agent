import { NextRequest, NextResponse } from 'next/server'
import { ExecutionEngine } from '../../../../execution/engine'
import { ContextManager } from '../../../../execution/services/context-manager'
import { FileService } from '../../../../execution/services/file-service'
import { GitService } from '../../../../execution/services/git-service'
import { LLMService } from '../../../../execution/services/llm-service'
import { ConfigService } from '../../../../execution/services/config-service'
import { PlanAgent } from '../../../../execution/agents/plan-agent'
import { ImplementAgent } from '../../../../execution/agents/implement-agent'
import { VerifyAgent } from '../../../../execution/agents/verify-agent'

let engine: ExecutionEngine | null = null

export async function POST(request: NextRequest) {
  try {
    if (engine && engine.getCurrentExecution()) {
      return NextResponse.json(
        { error: 'Execution already running' },
        { status: 400 }
      )
    }

    // Validate API key before starting
    const configService = new ConfigService()
    const hasValidKey = await configService.validateAPIKeys()
    if (!hasValidKey) {
      const msg = configService.getAPIKeyErrorMessage()
      return NextResponse.json(
        { error: msg.error, details: msg.details },
        { status: 400 }
      )
    }

    // Initialize services
    const context = new ContextManager()
    const fileService = new FileService()
    const gitService = new GitService()
    const llmService = new LLMService()

    // Create engine
    engine = new ExecutionEngine()

    // Register agents
    engine.registerAgent('PLAN', () => new PlanAgent(context, fileService, gitService, llmService))
    engine.registerAgent('IMPLEMENT', () => new ImplementAgent(context, fileService, gitService, llmService))
    engine.registerAgent('VERIFY', () => new VerifyAgent(context, fileService, gitService, llmService))

    // Check current state - if DONE or FAIL, reset to PLAN
    const { StateWatcher } = await import('../../../../execution/watcher')
    const watcher = new StateWatcher()
    const currentState = await watcher.readState()
    
    if (currentState === 'DONE' || currentState === 'FAIL') {
      await watcher.writeState('PLAN')
    }

    // Start engine
    await engine.start()

    return NextResponse.json({ 
      success: true, 
      message: 'Execution started',
      initialState: currentState,
      newState: currentState === 'DONE' || currentState === 'FAIL' ? 'PLAN' : currentState
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Provide helpful error messages
    if (errorMessage.includes('API key') || errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('ANTHROPIC_API_KEY')) {
      const configService = new ConfigService()
      const msg = configService.getAPIKeyErrorMessage()
      return NextResponse.json(
        { error: msg.error, details: errorMessage, fix: msg.details },
        { status: 400 }
      )
    }
    
    if (errorMessage.includes('config') || errorMessage.includes('config.json')) {
      return NextResponse.json(
        { 
          error: 'Configuration error',
          details: errorMessage,
          fix: 'Check control/config.json format and ensure it exists'
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
