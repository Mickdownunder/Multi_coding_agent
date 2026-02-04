'use client'

import { useState, useEffect } from 'react'

const VALID_STATES = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL'] as const
type State = typeof VALID_STATES[number]

const VALID_TRANSITIONS: Record<State, State[]> = {
  PLAN: ['IMPLEMENT'],
  IMPLEMENT: ['VERIFY', 'FAIL'],
  VERIFY: ['DONE', 'PLAN', 'FAIL'],
  DONE: ['PLAN'],
  FAIL: ['PLAN']
}

export default function StateMachine() {
  const [currentState, setCurrentState] = useState<State | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch('/api/state')
        const data = await res.json()
        setCurrentState(data.state as State)
      } catch (error) {
        console.error('Failed to fetch state:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchState()
    const interval = setInterval(fetchState, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleTransition = async (newState: State) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState, currentState })
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to transition state')
        return
      }

      setCurrentState(newState)
    } catch (error) {
      alert('Failed to transition state')
    }
  }

  if (loading) {
    return <div className="loading">Loading state machine...</div>
  }

  if (!currentState) {
    return <div className="error">Failed to load state</div>
  }

  const canTransition = (to: State): boolean => {
    if (!currentState) return true
    return VALID_TRANSITIONS[currentState]?.includes(to) ?? false
  }

  return (
    <div className="state-machine">
      <h2>State Machine</h2>
      
      <div className="state-diagram">
        {VALID_STATES.map(state => {
          const isCurrent = state === currentState
          const canTrans = canTransition(state)
          
          return (
            <div
              key={state}
              className={`state-node ${isCurrent ? 'current' : ''} ${!canTrans ? 'disabled' : ''}`}
              onClick={() => canTrans && handleTransition(state)}
              title={!canTrans && currentState ? `Cannot transition from ${currentState} to ${state}` : ''}
            >
              {state}
            </div>
          )
        })}
      </div>

      <div className="state-info">
        <div><strong>Current State:</strong> {currentState}</div>
        <div><strong>Valid Transitions:</strong> {VALID_TRANSITIONS[currentState]?.join(', ') || 'None'}</div>
      </div>
    </div>
  )
}
