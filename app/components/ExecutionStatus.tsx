'use client'

import { useState, useEffect } from 'react'

interface Status {
  state: string
  running: boolean
  currentStep?: string
  lastUpdate: string
  progress?: {
    completedSteps: string[]
    totalSteps?: number
    progressPercent?: number
  }
}

export default function ExecutionStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      // Only fetch status, not logs (logs are fetched separately by ExecutionLogs component)
      const statusRes = await fetch('/api/execute/status')
      const statusData = await statusRes.json()
      
      setStatus({
        state: statusData.state || 'UNKNOWN',
        running: statusData.running || false,
        lastUpdate: new Date().toLocaleTimeString(),
        progress: statusData.progress
      })
      
      // Fetch logs separately only if running
      if (statusData.running) {
        try {
          const logsRes = await fetch('/api/execute/logs?lines=5')
          const logsData = await logsRes.json()
          setLogs(logsData.logs || [])
        } catch (error) {
          // Ignore log fetch errors
        }
      }
      
      setError(null)
    } catch (error) {
      console.error('Failed to fetch status:', error)
      setError('Failed to load execution status')
    }
  }

  useEffect(() => {
    fetchStatus()
    
    // Listen for global refresh event
    const handleRefresh = () => {
      fetchStatus() // Force refresh
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    // Only poll if running (not PLAN, DONE, or FAIL)
    const poll = async () => {
      // Check current status before polling
      try {
        const statusRes = await fetch('/api/execute/status')
        const statusData = await statusRes.json()
        
        // Only fetch full status if running
        if (statusData.running && statusData.state !== 'PLAN' && statusData.state !== 'DONE' && statusData.state !== 'FAIL') {
          fetchStatus()
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    const interval = setInterval(poll, 10000) // Poll every 10 seconds (reduced frequency)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, []) // Empty dependencies - only run once on mount

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

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'PLAN': return '#5c9aff'
      case 'IMPLEMENT': return '#ffa500'
      case 'VERIFY': return '#7ec87e'
      case 'DONE': return '#4caf50'
      case 'FAIL': return '#ff6b6b'
      default: return '#888'
    }
  }

  const getLastLogMessage = (): string => {
    if (logs.length === 0) return 'No logs yet'
    const lastLog = logs[logs.length - 1]
    return lastLog.message || 'No message'
  }

  return (
    <div className="execution-status" style={{
      background: '#252525',
      border: '1px solid #333',
      padding: '20px',
      marginBottom: '24px',
      borderRadius: '4px'
    }}>
      <h2 style={{ marginBottom: '16px' }}>Live Status</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Current State</div>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: getStateColor(status?.state || 'UNKNOWN'),
            fontFamily: 'monospace'
          }}>
            {status?.state || 'UNKNOWN'}
          </div>
        </div>
        
        <div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Status</div>
          <div style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: status?.running ? '#5c9aff' : '#888',
            fontFamily: 'monospace'
          }}>
            {status?.running ? 'RUNNING' : 'STOPPED'}
          </div>
        </div>

        {status?.progress && status.progress.totalSteps !== undefined && (
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Progress</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#7ec87e',
              fontFamily: 'monospace'
            }}>
              {status.progress.progressPercent || 0}%
            </div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {status.progress.completedSteps.length} / {status.progress.totalSteps} steps
            </div>
          </div>
        )}
      </div>

      <div style={{
        background: '#1a1a1a',
        border: '1px solid #333',
        padding: '12px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        marginBottom: '16px'
      }}>
        <div style={{ color: '#888', marginBottom: '8px' }}>Last Activity:</div>
        <div style={{ color: '#e0e0e0' }}>{getLastLogMessage()}</div>
        <div style={{ color: '#666', fontSize: '11px', marginTop: '8px' }}>
          Updated: {status?.lastUpdate || 'Never'}
        </div>
      </div>

      {error && (
        <div style={{ 
          background: '#ff6b6b', 
          color: '#1a1a1a', 
          padding: '8px 12px', 
          borderRadius: '4px', 
          marginBottom: '16px',
          fontSize: '12px'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {!status?.running ? (
          <button
            onClick={handleStart}
            disabled={starting}
            style={{
              padding: '8px 16px',
              background: starting ? '#444' : '#5c9aff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: starting ? 'not-allowed' : 'pointer',
              opacity: starting ? 0.6 : 1
            }}
          >
            {starting ? 'Starting...' : 'Start Execution'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={stopping}
            style={{
              padding: '8px 16px',
              background: stopping ? '#444' : '#ff6b6b',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: stopping ? 'not-allowed' : 'pointer',
              opacity: stopping ? 0.6 : 1
            }}
          >
            {stopping ? 'Stopping...' : 'Stop Execution'}
          </button>
        )}
      </div>
    </div>
  )
}
