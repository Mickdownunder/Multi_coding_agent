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
    
    const handleRefresh = () => {
      fetchLogs(true)
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    const poll = async () => {
      try {
        const statusRes = await fetch('/api/execute/status')
        const statusData = await statusRes.json()
        
        if (statusData.running && statusData.state !== 'PLAN' && statusData.state !== 'DONE' && statusData.state !== 'FAIL') {
          fetchLogs()
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    const interval = setInterval(poll, 5000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [lines])

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'ERROR':
        return '#ff1744'
      case 'WARN':
        return '#ffb800'
      case 'INFO':
        return '#00d4ff'
      case 'DEBUG':
        return '#64748b'
      default:
        return '#39ff14'
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

  // Syntax highlighting for terminal-style logs
  const highlightMessage = (message: string): JSX.Element[] => {
    const parts: JSX.Element[] = []
    let lastIndex = 0

    // File operations (Atomic Blue)
    const filePatterns = [
      /\[FileService\]/g,
      /createFile|modifyFile|deleteFile/g,
      /\.tsx?|\.jsx?|\.json|\.md/g
    ]
    
    // Git operations (Cyber Lime)
    const gitPatterns = [
      /\[GitService\]/g,
      /commit|push|pull|merge|branch/g,
      /git\s+\w+/gi
    ]
    
    // Errors (Crimson)
    const errorPatterns = [
      /\[ERROR\]/g,
      /Error:|Failed|Exception|Fatal/gi
    ]
    
    // State changes (Amber)
    const statePatterns = [
      /State changed to:|Transitioned to|Entering|Exiting/gi,
      /PLAN|IMPLEMENT|VERIFY|DONE|FAIL/g
    ]

    // Agent names (Atomic Blue with glow)
    const agentPatterns = [
      /\[PlanAgent\]|\[ImplementAgent\]|\[VerifyAgent\]/g,
      /\[ExecutionEngine\]/g
    ]

    const matches: Array<{ start: number; end: number; color: string; type: string }> = []

    // Find all matches
    filePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          color: '#00d4ff',
          type: 'file'
        })
      }
    })

    gitPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          color: '#39ff14',
          type: 'git'
        })
      }
    })

    errorPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          color: '#ff1744',
          type: 'error'
        })
      }
    })

    statePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          color: '#ffb800',
          type: 'state'
        })
      }
    })

    agentPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          color: '#00d4ff',
          type: 'agent'
        })
      }
    })

    // Sort matches by start position
    matches.sort((a, b) => a.start - b.start)

    // Remove overlapping matches (keep first)
    const filteredMatches: typeof matches = []
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i]
      const overlaps = filteredMatches.some(m => 
        (current.start >= m.start && current.start < m.end) ||
        (current.end > m.start && current.end <= m.end)
      )
      if (!overlaps) {
        filteredMatches.push(current)
      }
    }

    // Build highlighted parts
    filteredMatches.forEach((match, index) => {
      // Add text before match
      if (match.start > lastIndex) {
        parts.push(
          <span key={`text-${index}`} style={{ color: '#00ff00' }}>
            {message.substring(lastIndex, match.start)}
          </span>
        )
      }

      // Add highlighted match
      parts.push(
        <span
          key={`match-${index}`}
          style={{
            color: match.color,
            fontWeight: match.type === 'error' || match.type === 'agent' ? 700 : 600,
            textShadow: match.type === 'agent' ? `0 0 8px ${match.color}40` : 'none'
          }}
        >
          {message.substring(match.start, match.end)}
        </span>
      )

      lastIndex = match.end
    })

    // Add remaining text
    if (lastIndex < message.length) {
      parts.push(
        <span key="text-end" style={{ color: '#00ff00' }}>
          {message.substring(lastIndex)}
        </span>
      )
    }

    return parts.length > 0 ? parts : [<span key="default" style={{ color: '#00ff00' }}>{message}</span>]
  }

  if (loading && logs.length === 0) {
    return (
      <div className="card glass-card" style={{ padding: '24px' }}>
        <div style={{ color: '#00ff00', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
          $ Loading logs...
        </div>
      </div>
    )
  }

  return (
    <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '18px', 
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif'
        }}>
          Terminal Logs
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ 
            fontSize: '11px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ 
                cursor: 'pointer',
                accentColor: '#00d4ff'
              }}
            />
            Auto-scroll
          </label>
          <select
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value, 10))}
            className="input-industrial"
            style={{ 
              padding: '6px 10px', 
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
          </select>
          <button
            onClick={async () => {
              if (!confirm('Clear all execution logs?')) {
                return
              }
              setLoading(true)
              try {
                const res = await fetch('/api/execute/logs/clear', { 
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                })
                const data = await res.json()
                if (res.ok) {
                  setLogs([])
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
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '11px' }}
          >
            {loading ? 'Clearing...' : 'Clear'}
          </button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        style={{
          background: '#0a0a0a',
          border: '2px solid #1a1a1a',
          borderRadius: 0,
          padding: '16px',
          fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
          fontSize: '12px',
          lineHeight: '1.6',
          maxHeight: '600px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          position: 'relative',
          boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)'
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic', fontFamily: 'monospace' }}>
            $ No logs yet. Start an execution to see logs here.
            <span className="terminal-cursor" />
          </div>
        ) : (
          <>
            {logs.map((log, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '2px',
                  padding: '4px 0',
                  borderLeft: `2px solid ${getLevelColor(log.level)}`,
                  paddingLeft: '12px',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                <span style={{ color: '#64748b', marginRight: '12px', fontFamily: 'monospace' }}>
                  [{formatTimestamp(log.timestamp)}]
                </span>
                <span
                  style={{
                    color: getLevelColor(log.level),
                    fontWeight: 700,
                    marginRight: '12px',
                    minWidth: '60px',
                    display: 'inline-block',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  [{log.level}]
                </span>
                <span style={{ color: '#00ff00' }}>&gt;</span>
                <span style={{ marginLeft: '8px' }}>
                  {highlightMessage(log.message)}
                </span>
              </div>
            ))}
            {autoScroll && (
              <div style={{ 
                color: '#00ff00', 
                fontFamily: 'monospace',
                marginTop: '8px',
                paddingLeft: '12px'
              }}>
                $ <span className="terminal-cursor" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
