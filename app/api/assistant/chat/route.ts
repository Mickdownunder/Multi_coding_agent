import { NextRequest, NextResponse } from 'next/server'
import { LLMService } from '../../../../execution/services/llm-service'
import { IntentGenerator } from '../../../../execution/services/intent-generator'
import { TokenBudgetService } from '../../../../execution/services/token-budget-service'

const llmService = new LLMService()
const intentGenerator = new IntentGenerator()
const tokenBudget = new TokenBudgetService()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, history = [] } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Add user message to history
    const updatedHistory = [...history, { role: 'user', content: message }]

    // Get response from LLM with timeout
    const response = await Promise.race([
      llmService.chatWithUser(message, history),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Chat request timed out after 60 seconds')), 60000)
      )
    ]) as Awaited<ReturnType<typeof llmService.chatWithUser>>

    // Check if user wants to generate intent
    if (message.toLowerCase().includes('generate intent') || message.toLowerCase().includes('create intent')) {
      const { intent, cost } = await intentGenerator.generateFromChat(updatedHistory)
      const validation = await intentGenerator.validateIntent(intent)

      return NextResponse.json({
        response: typeof response === 'object' && 'response' in response ? response.response : 'Intent generated',
        suggestedIntent: intent,
        validation,
        costEstimate: cost,
        questions: typeof response === 'object' && 'questions' in response ? response.questions : []
      })
    }

    // Get token usage
    const costEstimate = await tokenBudget.getCostEstimate()

    return NextResponse.json({
      response: typeof response === 'object' && 'response' in response ? response.response : 'Response',
      suggestedIntent: typeof response === 'object' && 'suggestedIntent' in response ? response.suggestedIntent : undefined,
      questions: typeof response === 'object' && 'questions' in response ? response.questions : [],
      costEstimate: costEstimate.totalCost
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Provide helpful error messages
    if (errorMessage.includes('API key') || errorMessage.includes('OPENAI_API_KEY')) {
      return NextResponse.json(
        { 
          error: 'API key configuration error',
          details: errorMessage,
          fix: 'Set OPENAI_API_KEY environment variable: export OPENAI_API_KEY="sk-..."'
        },
        { status: 400 }
      )
    }
    
    // Handle timeout errors specifically
    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return NextResponse.json(
        { 
          error: 'Request timed out',
          details: 'The chat request took too long. Please try again or check your API key configuration.',
          fix: 'Check your GEMINI_API_KEY or OPENAI_API_KEY environment variable'
        },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
