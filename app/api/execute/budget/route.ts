import { NextRequest, NextResponse } from 'next/server'
import { TokenBudgetService } from '../../../../execution/services/token-budget-service'

const tokenBudget = new TokenBudgetService()

export async function GET(request: NextRequest) {
  try {
    // Check if force reload is requested (from query params)
    const forceReload = request.nextUrl.searchParams.get('force') === '1'
    
    const estimate = await tokenBudget.getCostEstimate(forceReload)
    const remaining = await tokenBudget.getRemainingBudget()
    const warning = await tokenBudget.isWarningThreshold()
    
    // Get the original budget limit from config
    const { ConfigService } = await import('../../../../execution/services/config-service')
    const configService = new ConfigService()
    await configService.loadConfig()
    const tokenConfig = configService.getTokenBudgetConfig()
    const maxPerProject = tokenConfig.maxPerProject

    // Return data in the format expected by the component
    return NextResponse.json({
      totalCost: estimate.totalCost,
      tokensUsed: estimate.tokensUsed,
      tokensRemaining: remaining, // Can be negative if exceeded
      maxPerProject: maxPerProject, // Original budget limit
      costBreakdown: estimate.costBreakdown,
      warning: warning,
      remaining: remaining // Keep for backwards compatibility
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
