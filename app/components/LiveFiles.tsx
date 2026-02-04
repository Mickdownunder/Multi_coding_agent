'use client'

import { useState, useEffect } from 'react'

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
      // Check if execution is running first
      const statusRes = await fetch(`/api/execute/status?t=${Date.now()}${force ? '&force=1' : ''}`)
      const statusData = await statusRes.json()
      setIsRunning(statusData.running)

      // Always fetch files if running, or if we have files from previous run
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
    
    // Listen for global refresh event
    const handleRefresh = () => {
      fetchFiles() // Force refresh
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    // Poll every 5 seconds if running
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
      <div className="live-files" style={{
        background: '#252525',
        border: '1px solid #333',
        padding: '20px',
        borderRadius: '4px',
        marginBottom: '24px'
      }}>
        <h2>Live Files</h2>
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="live-files" style={{
      background: '#252525',
      border: '1px solid #333',
      padding: '20px',
      borderRadius: '4px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>Live Files</h2>
        {isRunning && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#5c9aff'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#5c9aff',
              animation: 'pulse 2s infinite'
            }}></div>
            Live
          </div>
        )}
      </div>

      {!isRunning && files.length === 0 && (
        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
          No recent file activity. Start execution to see files being created.
        </div>
      )}

      {files.length > 0 && (
        <div style={{
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '4px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {files.map((file, index) => (
            <div
              key={index}
              style={{
                padding: '12px',
                borderBottom: index < files.length - 1 ? '1px solid #333' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#5c9aff', marginBottom: '4px', wordBreak: 'break-all' }}>
                  📄 {file.path}
                </div>
                <div style={{ color: '#666', fontSize: '11px' }}>
                  {formatSize(file.size)} • {formatTime(file.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {files.length === 0 && isRunning && (
        <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
          Waiting for files to be created...
        </div>
      )}
    </div>
  )
}
