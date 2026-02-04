'use client'

import { useState, useEffect } from 'react'
import { FileText, Zap } from 'lucide-react'

interface CreatedFile {
  path: string
  size: number
  createdAt: string
  stepId?: string
}

export default function LiveFiles() {
  const [files, setFiles] = useState<CreatedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  const fetchFiles = async (force = false) => {
    try {
      const statusRes = await fetch(`/api/execute/status?t=${Date.now()}${force ? '&force=1' : ''}`)
      const statusData = await statusRes.json()
      setIsRunning(statusData.running)

      const res = await fetch(`/api/execute/files?t=${Date.now()}${force ? '&force=1' : ''}`)
      const data = await res.json()
      if (res.ok) {
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
    
    const handleRefresh = () => {
      fetchFiles(true)
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    const poll = () => {
      if (isRunning) {
        fetchFiles()
      }
    }
    
    const interval = setInterval(poll, 5000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [isRunning])

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatTime = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    
    if (seconds < 60) return `${seconds}s ago`
    if (minutes < 60) return `${minutes}m ago`
    return date.toLocaleTimeString()
  }

  if (loading && files.length === 0) {
    return (
      <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '18px', 
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif',
          marginBottom: '16px'
        }}>
          Live Files
        </h2>
        <div style={{ 
          color: 'var(--text-muted)', 
          fontFamily: 'monospace', 
          fontSize: '12px' 
        }}>
          $ Loading...
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
          fontFamily: 'Inter, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <FileText size={18} style={{ color: 'var(--atomic-blue)' }} />
          Live Files
        </h2>
        {isRunning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--cyber-lime)',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: 'var(--cyber-lime)',
              boxShadow: '0 0 8px var(--cyber-lime)',
              borderRadius: 0,
              animation: 'pulse 2s infinite'
            }}></div>
            Live
          </div>
        )}
      </div>

      {!isRunning && files.length === 0 && (
        <div style={{ 
          color: 'var(--text-muted)', 
          fontStyle: 'italic', 
          textAlign: 'center', 
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          $ No recent file activity. Start execution to see files being created.
        </div>
      )}

      {files.length > 0 && (
        <div className="glass-surface" style={{
          background: 'rgba(11, 15, 26, 0.6)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                padding: '12px 16px',
                borderBottom: index < files.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  color: 'var(--atomic-blue)', 
                  marginBottom: '4px', 
                  wordBreak: 'break-all',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <FileText size={14} style={{ color: 'var(--atomic-blue)', flexShrink: 0 }} />
                  <span>{file.path}</span>
                </div>
                <div style={{ 
                  color: 'var(--text-muted)', 
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  marginLeft: '22px'
                }}>
                  {formatSize(file.size)} • {formatTime(file.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && isRunning && (
        <div style={{ 
          color: 'var(--text-muted)', 
          fontStyle: 'italic', 
          textAlign: 'center', 
          padding: '20px',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          $ Waiting for files to be created...
          <span className="terminal-cursor" />
        </div>
      )}
    </div>
  )
}
