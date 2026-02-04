'use client'

import { useState, useEffect } from 'react'

interface BudgetData {
  totalCost: number
  tokensUsed: number
  tokensRemaining: number
  maxPerProject?: number // Original budget limit
  costBreakdown: {
    plan: number
    code: number
    chat: number
  }
  warning: boolean
}

export default function TokenBudgetTracker() {
  const [budget, setBudget] = useState<BudgetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchBudget = async (showLoading = false, force = false) => {
    if (showLoading) {
      setRefreshing(true)
    }
    try {
      // Add cache-busting timestamp to force refresh
      const url = `/api/execute/budget?t=${Date.now()}${force ? '&force=1' : ''}`
      const res = await fetch(url, {
        cache: 'no-store', // Force no cache
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await res.json()
      if (res.ok) {
        // API now returns the correct format, use it directly
        const budgetData = {
          totalCost: data.totalCost || 0,
          tokensUsed: data.tokensUsed || 0,
          tokensRemaining: data.tokensRemaining !== undefined ? data.tokensRemaining : (data.remaining || 0),
          maxPerProject: data.maxPerProject,
          costBreakdown: {
            plan: data.costBreakdown?.plan || 0,
            code: data.costBreakdown?.code || 0,
            chat: data.costBreakdown?.chat || 0
          },
          warning: data.warning || false
        }
        setBudget(budgetData)
      } else {
        console.error('Failed to fetch budget:', data.error)
      }
    } catch (error) {
      console.error('Failed to fetch budget:', error)
    } finally {
      if (showLoading) {
        setRefreshing(false)
      }
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBudget()
    
    // Listen for global refresh event
    const handleRefresh = () => {
      fetchBudget(true, true) // Force refresh with loading state
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    // Check if execution is running before polling
    const checkAndPoll = async () => {
      try {
        const statusRes = await fetch('/api/execute/status')
        const statusData = await statusRes.json()
        // Only poll if execution is actually running (IMPLEMENT or VERIFY)
        // Don't poll if PLAN, DONE, or FAIL
        if (statusData.running && statusData.state !== 'PLAN' && statusData.state !== 'DONE' && statusData.state !== 'FAIL') {
          fetchBudget(false)
        }
      } catch (error) {
        // If status check fails, don't poll (avoid unnecessary requests)
      }
    }
    
    // Poll every 15 seconds (reduced frequency), but only if execution is running
    const interval = setInterval(checkAndPoll, 15000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [])

  if (loading) {
    return <div className="loading">Loading budget...</div>
  }

  if (!budget) {
    return <div className="error">Failed to load budget</div>
  }

  // Calculate usage percentage correctly
  const isExceeded = budget.tokensRemaining < 0
  
  // Use maxPerProject from API if available, otherwise calculate from tokensUsed + tokensRemaining
  const originalBudgetLimit = budget.maxPerProject || (budget.tokensUsed + Math.max(0, budget.tokensRemaining))
  
  const usagePercent = originalBudgetLimit > 0
    ? ((budget.tokensUsed / originalBudgetLimit) * 100).toFixed(1)
    : '100'

  return (
    <div className="token-budget-tracker">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Token Budget</h2>
        <button
          onClick={async () => {
            if (!confirm('Token Budget wirklich zurücksetzen? Alle Token-Zähler werden auf 0 gesetzt.')) {
              return
            }
            setRefreshing(true)
            try {
              // Reset budget
              const res = await fetch('/api/execute/budget/reset', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              })
              const data = await res.json()
              if (res.ok) {
                // Update budget directly from response if available
                if (data.budget) {
                  setBudget({
                    totalCost: data.budget.totalCost || 0,
                    tokensUsed: data.budget.tokensUsed || 0,
                    tokensRemaining: data.budget.tokensRemaining || 0,
                    maxPerProject: data.budget.maxPerProject,
                    costBreakdown: data.budget.costBreakdown || { plan: 0, code: 0, chat: 0 },
                    warning: data.budget.warning || false
                  })
                } else {
                  // Fallback: fetch budget
                  await fetchBudget(true, true)
                }
                // Also trigger global refresh
                window.dispatchEvent(new Event('dashboard-refresh'))
              } else {
                alert(data.error || 'Failed to reset budget')
              }
            } catch (error) {
              console.error('Failed to reset budget:', error)
              alert(`Failed to reset budget: ${error instanceof Error ? error.message : 'Unknown error'}`)
            } finally {
              setRefreshing(false)
            }
          }}
          disabled={refreshing}
          style={{
            padding: '4px 12px',
            background: refreshing ? '#444' : '#5c9aff',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            opacity: refreshing ? 0.6 : 1
          }}
        >
          {refreshing ? 'Resetting...' : 'Reset'}
        </button>
      </div>
      
      <div className="budget-summary">
        <div className="budget-item">
          <strong>Total Cost:</strong> ${budget.totalCost.toFixed(2)}
        </div>
        <div className="budget-item">
          <strong>Tokens Used:</strong> {budget.tokensUsed.toLocaleString()}
        </div>
        <div className="budget-item">
          <strong>Tokens Remaining:</strong> {budget.tokensRemaining > 0 ? budget.tokensRemaining.toLocaleString() : '0 (exceeded)'}
        </div>
        <div className="budget-item">
          <strong>Usage:</strong> {isExceeded ? `${usagePercent}% (exceeded)` : `${usagePercent}%`}
        </div>
      </div>

      {budget.warning && (
        <div className="budget-warning" style={{
          background: budget.tokensRemaining < 0 ? '#ff6b6b' : '#ffa500',
          color: '#1a1a1a',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {budget.tokensRemaining < 0 ? (
            <>⚠️ Budget exceeded: {Math.abs(budget.tokensRemaining).toLocaleString()} tokens over limit</>
          ) : (
            <>⚠️ Budget warning: {usagePercent}% used</>
          )}
        </div>
      )}

      {(isExceeded || budget.warning) && (
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={async () => {
              setResetting(true)
              try {
                const res = await fetch('/api/execute/budget/reset', { method: 'POST' })
                if (res.ok) {
                  // Refresh budget after reset
                  await fetchBudget(true, true)
                } else {
                  const errorData = await res.json()
                  alert(errorData.error || 'Failed to reset budget')
                }
              } catch (error) {
                console.error('Failed to reset budget:', error)
                alert('Failed to reset budget. Please try again.')
              } finally {
                setResetting(false)
              }
            }}
            disabled={resetting}
            style={{
              padding: '8px 16px',
              background: resetting ? '#444' : '#5c9aff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: resetting ? 'not-allowed' : 'pointer',
              opacity: resetting ? 0.6 : 1
            }}
          >
            {resetting ? 'Resetting...' : 'Reset Budget'}
          </button>
        </div>
      )}

      <div className="cost-breakdown">
        <h3>Cost Breakdown</h3>
        <div className="breakdown-item">
          <span>Plan:</span> <span>${budget.costBreakdown.plan.toFixed(2)}</span>
        </div>
        <div className="breakdown-item">
          <span>Code:</span> <span>${budget.costBreakdown.code.toFixed(2)}</span>
        </div>
        <div className="breakdown-item">
          <span>Chat:</span> <span>${budget.costBreakdown.chat.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
