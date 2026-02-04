'use client'

import { useState, useEffect } from 'react'

interface ExecutionStatus {
  state: string
  progress: {
    completedSteps: string[]
  }
  running: boolean
}

export default function ExecutionMonitor() {
  const [status, setStatus] = useState<ExecutionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/execute/status')
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (error) {
      console.error('Failed to fetch status:', error)
      setError('Failed to load execution status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/execute/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start execution')
      } else {
        // Refresh status after starting
        setTimeout(() => fetchStatus(), 1000)
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    setStopping(true)
    setError(null)
    try {
      const res = await fetch('/api/execute/stop', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to stop execution')
      } else {
        // Refresh status after stopping
        setTimeout(() => fetchStatus(), 1000)
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setStopping(false)
    }
  }

  if (loading) {
    return <div className="loading">Loading execution status...</div>
  }

  return (
    <div className="execution-monitor">
      <h2>Execution Monitor</h2>
      
      {error && (
        <div className="error" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}
      
      <div className="status-section">
        <div className="status-item">
          <strong>State:</strong> <span className={`state-${status?.state || 'unknown'}`}>{status?.state || 'Unknown'}</span>
        </div>
        <div className="status-item">
          <strong>Running:</strong> {status?.running ? 'Yes' : 'No'}
        </div>
        <div className="status-item">
          <strong>Completed Steps:</strong> {status?.progress.completedSteps.length || 0}
        </div>
      </div>

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        {!status?.running ? (
          <button
            className="state-btn"
            onClick={handleStart}
            disabled={starting}
            style={{ background: '#5c9aff', color: '#1a1a1a', border: 'none' }}
          >
            {starting ? 'Starting...' : 'Start Execution'}
          </button>
        ) : (
          <button
            className="state-btn"
            onClick={handleStop}
            disabled={stopping}
            style={{ background: '#ff6b6b', color: '#1a1a1a', border: 'none' }}
          >
            {stopping ? 'Stopping...' : 'Stop Execution'}
          </button>
        )}
      </div>
    </div>
  )
}
