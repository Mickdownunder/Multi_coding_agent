import { NextRequest, NextResponse } from 'next/server'
import { TokenBudgetService } from '../../../../../execution/services/token-budget-service'

const tokenBudget = new TokenBudgetService()

export async function POST() {
  try {
    await tokenBudget.resetBudget()
    // Return the reset budget data immediately so frontend can update
    const estimate = await tokenBudget.getCostEstimate(true) // Force reload
    const remaining = await tokenBudget.getRemainingBudget()
    const warning = await tokenBudget.isWarningThreshold()
    
    const { ConfigService } = await import('../../../../../execution/services/config-service')
    const configService = new ConfigService()
    await configService.loadConfig()
    const tokenConfig = configService.getTokenBudgetConfig()
    
    return NextResponse.json({ 
      success: true, 
      message: 'Budget reset successfully',
      budget: {
        totalCost: estimate.totalCost,
        tokensUsed: estimate.tokensUsed,
        tokensRemaining: remaining,
        maxPerProject: tokenConfig.maxPerProject,
        costBreakdown: estimate.costBreakdown,
        warning: warning
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
