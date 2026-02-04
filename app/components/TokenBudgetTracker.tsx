'use client'

import { useState, useEffect } from 'react'
import { Zap, DollarSign, TrendingUp } from 'lucide-react'

interface BudgetData {
  totalCost: number
  tokensUsed: number
  tokensRemaining: number
  maxPerProject?: number
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
      const url = `/api/execute/budget?t=${Date.now()}${force ? '&force=1' : ''}`
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await res.json()
      if (res.ok) {
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
    
    const handleRefresh = () => {
      fetchBudget(true, true)
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    const checkAndPoll = async () => {
      try {
        const statusRes = await fetch('/api/execute/status')
        const statusData = await statusRes.json()
        if (statusData.running && statusData.state !== 'PLAN' && statusData.state !== 'DONE' && statusData.state !== 'FAIL') {
          fetchBudget(false)
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    const interval = setInterval(checkAndPoll, 15000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [])

  if (loading) {
    return (
      <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '12px' }}>
          $ Loading budget...
        </div>
      </div>
    )
  }

  if (!budget) {
    return (
      <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ color: 'var(--error-crimson)', fontFamily: 'monospace', fontSize: '12px' }}>
          $ Failed to load budget
        </div>
      </div>
    )
  }

  const isExceeded = budget.tokensRemaining < 0
  const originalBudgetLimit = budget.maxPerProject || (budget.tokensUsed + Math.max(0, budget.tokensRemaining))
  const usagePercent = originalBudgetLimit > 0
    ? ((budget.tokensUsed / originalBudgetLimit) * 100).toFixed(1)
    : '100'

  return (
    <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '18px', 
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Zap size={18} style={{ color: 'var(--warning-amber)' }} />
          Token Budget
        </h2>
        <button
          onClick={async () => {
            if (!confirm('Token Budget wirklich zurücksetzen?')) {
              return
            }
            setRefreshing(true)
            try {
              const res = await fetch('/api/execute/budget/reset', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
              })
              const data = await res.json()
              if (res.ok) {
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
                  await fetchBudget(true, true)
                }
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
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '11px' }}
        >
          {refreshing ? 'Resetting...' : 'Reset'}
        </button>
      </div>
      
      {/* Budget Summary Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <DollarSign size={10} /> Total Cost
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'var(--atomic-blue)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            ${budget.totalCost.toFixed(2)}
          </div>
        </div>

        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Tokens Used
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: isExceeded ? 'var(--error-crimson)' : 'var(--text-primary)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {budget.tokensUsed.toLocaleString()}
          </div>
        </div>

        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Remaining
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: budget.tokensRemaining > 0 ? 'var(--success-emerald)' : 'var(--error-crimson)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {budget.tokensRemaining > 0 ? budget.tokensRemaining.toLocaleString() : '0'}
          </div>
          {isExceeded && (
            <div style={{ fontSize: '10px', color: 'var(--error-crimson)', marginTop: '4px', fontFamily: 'monospace' }}>
              +{Math.abs(budget.tokensRemaining).toLocaleString()} over
            </div>
          )}
        </div>

        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={10} /> Usage
          </div>
          <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: isExceeded ? 'var(--error-crimson)' : parseFloat(usagePercent) > 80 ? 'var(--warning-amber)' : 'var(--success-emerald)',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {usagePercent}%
          </div>
          <div style={{ 
            width: '100%', 
            height: '4px', 
            background: 'var(--bg-void)', 
            marginTop: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{
              width: `${Math.min(100, parseFloat(usagePercent))}%`,
              height: '100%',
              background: isExceeded ? 'var(--error-crimson)' : parseFloat(usagePercent) > 80 ? 'var(--warning-amber)' : 'var(--success-emerald)',
              boxShadow: `0 0 8px ${isExceeded ? 'var(--error-crimson)' : parseFloat(usagePercent) > 80 ? 'var(--warning-amber)' : 'var(--success-emerald)'}40`
            }} />
          </div>
        </div>
      </div>

      {budget.warning && (
        <div style={{
          background: isExceeded ? 'rgba(255, 23, 68, 0.2)' : 'rgba(255, 184, 0, 0.2)',
          border: `1px solid ${isExceeded ? 'var(--error-crimson)' : 'var(--warning-amber)'}`,
          color: isExceeded ? 'var(--error-crimson)' : 'var(--warning-amber)',
          padding: '12px',
          borderRadius: 0,
          marginBottom: '16px',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          ⚠️ {isExceeded 
            ? `Budget exceeded: ${Math.abs(budget.tokensRemaining).toLocaleString()} tokens over limit`
            : `Budget warning: ${usagePercent}% used`
          }
        </div>
      )}

      {/* Cost Breakdown */}
      <div className="glass-surface" style={{ 
        padding: '16px', 
        border: '1px solid var(--border-subtle)',
        borderRadius: 0
      }}>
        <h3 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '12px', 
          fontWeight: 600,
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif'
        }}>
          Cost Breakdown
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '8px 0',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}>
            <span>Plan:</span> 
            <span style={{ color: 'var(--atomic-blue)', fontWeight: 600 }}>
              ${budget.costBreakdown.plan.toFixed(2)}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '8px 0',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}>
            <span>Code:</span> 
            <span style={{ color: 'var(--warning-amber)', fontWeight: 600 }}>
              ${budget.costBreakdown.code.toFixed(2)}
            </span>
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '8px 0',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontFamily: 'monospace'
          }}>
            <span>Chat:</span> 
            <span style={{ color: 'var(--cyber-lime)', fontWeight: 600 }}>
              ${budget.costBreakdown.chat.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
