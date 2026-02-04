'use client'

import { useState, useEffect, useRef } from 'react'

interface LogEntry {
  timestamp: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | string
  message: string
  raw: string
}

export default function ExecutionLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const [lines, setLines] = useState(100)
  const logContainerRef = useRef<HTMLDivElement>(null)

  const fetchLogs = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true)
    }
    try {
      // Add cache-busting timestamp to force refresh
      const res = await fetch(`/api/execute/logs?lines=${lines}&t=${Date.now()}`)
      const data = await res.json()
      if (res.ok) {
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchLogs()
    
    // Listen for global refresh event
    const handleRefresh = () => {
      fetchLogs(true) // Force refresh with loading state
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    // Only poll if execution is running (check status first)
    const poll = async () => {
      try {
        const statusRes = await fetch('/api/execute/status')
        const statusData = await statusRes.json()
        
        // Only poll if running (not PLAN, DONE, or FAIL)
        if (statusData.running && statusData.state !== 'PLAN' && statusData.state !== 'DONE' && statusData.state !== 'FAIL') {
          fetchLogs()
        }
      } catch (error) {
        // Ignore errors, just don't poll
      }
    }
    
    const interval = setInterval(poll, 10000) // Check every 10 seconds
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [lines]) // Only lines in dependencies, not logs

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'ERROR':
        return '#ff6b6b'
      case 'WARN':
        return '#ffa500'
      case 'INFO':
        return '#5c9aff'
      case 'DEBUG':
        return '#888'
      default:
        return '#ccc'
    }
  }

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('de-DE', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    } catch {
      return timestamp
    }
  }

  if (loading && logs.length === 0) {
    return <div className="loading">Loading logs...</div>
  }

  return (
    <div className="execution-logs">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2>Execution Logs</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ marginRight: '4px' }}
            />
            Auto-scroll
          </label>
          <select
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value, 10))}
            style={{ 
              padding: '4px 8px', 
              background: '#2a2a2a', 
              color: '#e0e0e0', 
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          >
            <option value={50}>Last 50 lines</option>
            <option value={100}>Last 100 lines</option>
            <option value={200}>Last 200 lines</option>
            <option value={500}>Last 500 lines</option>
          </select>
          <button
            onClick={async () => {
              if (!confirm('Execution Logs wirklich löschen?')) {
                return
              }
              setLoading(true)
              try {
                // Clear logs
                const res = await fetch('/api/execute/logs/clear', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                })
                const data = await res.json()
                if (res.ok) {
                  // Clear local state immediately
                  setLogs([])
                  // Also trigger global refresh
                  window.dispatchEvent(new Event('dashboard-refresh'))
                } else {
                  alert(data.error || 'Failed to clear logs')
                }
              } catch (error) {
                console.error('Failed to clear logs:', error)
                alert(`Failed to clear logs: ${error instanceof Error ? error.message : 'Unknown error'}`)
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
            style={{
              padding: '4px 12px',
              background: loading ? '#444' : '#5c9aff',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Clearing...' : 'Clear'}
          </button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: '12px',
          maxHeight: '500px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic' }}>
            No logs yet. Start an execution to see logs here.
          </div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                marginBottom: '4px',
                padding: '2px 0',
                borderLeft: `3px solid ${getLevelColor(log.level)}`,
                paddingLeft: '8px'
              }}
            >
              <span style={{ color: '#888', marginRight: '8px' }}>
                [{formatTimestamp(log.timestamp)}]
              </span>
              <span
                style={{
                  color: getLevelColor(log.level),
                  fontWeight: 'bold',
                  marginRight: '8px',
                  minWidth: '50px',
                  display: 'inline-block'
                }}
              >
                [{log.level}]
              </span>
              <span style={{ color: '#e0e0e0' }}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
