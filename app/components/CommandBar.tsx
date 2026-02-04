'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { 
  Play, 
  Square, 
  RefreshCw, 
  Trash2, 
  GitBranch, 
  Upload, 
  FileText, 
  Settings,
  Zap,
  Activity
} from 'lucide-react'

interface CommandBarProps {
  onCommand?: (command: string, args?: string[]) => void
}

export default function CommandBar({ onCommand }: CommandBarProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const handleSelect = (value: string) => {
    const [command, ...args] = value.split(' ')
    
    switch (command) {
      case 'start':
        fetch('/api/execute/start', { method: 'POST' })
        window.dispatchEvent(new Event('dashboard-refresh'))
        break
      case 'stop':
        fetch('/api/execute/stop', { method: 'POST' })
        window.dispatchEvent(new Event('dashboard-refresh'))
        break
      case 'clear-logs':
        if (confirm('Clear all execution logs?')) {
          fetch('/api/execute/logs/clear', { method: 'POST' })
          window.dispatchEvent(new Event('dashboard-refresh'))
        }
        break
      case 'reset-budget':
        if (confirm('Reset token budget?')) {
          fetch('/api/execute/budget/reset', { method: 'POST' })
          window.dispatchEvent(new Event('dashboard-refresh'))
        }
        break
      case 'git-push':
        fetch('/api/git/push', { method: 'POST', body: JSON.stringify({ remote: 'origin', branch: 'main' }) })
        break
      case 'git-status':
        fetch('/api/git/status').then(r => r.json()).then(data => {
          alert(`Git Status: ${data.initialized ? 'Initialized' : 'Not initialized'}\nBranch: ${data.branch || 'N/A'}`)
        })
        break
      case 'refresh':
        window.dispatchEvent(new Event('dashboard-refresh'))
        break
      case 'set-state':
        if (args[0] && ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL'].includes(args[0].toUpperCase())) {
          fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: args[0].toUpperCase() })
          })
          window.dispatchEvent(new Event('dashboard-refresh'))
        }
        break
    }

    if (onCommand) {
      onCommand(command, args)
    }
    
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(11, 15, 26, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh'
      }}
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '640px',
          maxWidth: '90vw',
          background: 'rgba(26, 31, 46, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '2px solid rgba(0, 212, 255, 0.3)',
          borderRadius: 0,
          boxShadow: '0 16px 64px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 212, 255, 0.1)',
          overflow: 'hidden'
        }}
      >
        <Command
          style={{
            background: 'transparent',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid var(--atomic-blue)',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: 'var(--atomic-blue)',
                boxShadow: '0 0 8px var(--atomic-blue)'
              }} />
            </div>
            <Command.Input
              placeholder="Type a command or search..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '14px'
              }}
            />
            <div style={{
              padding: '4px 8px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 0,
              fontSize: '10px',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ESC
            </div>
          </div>
          
          <Command.List style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px'
          }}>
            <Command.Empty style={{
              padding: '16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              No commands found.
            </Command.Empty>

            <Command.Group heading="Execution" style={{
              padding: '8px 0',
              color: 'var(--text-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              <Command.Item
                value="start execution"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Play size={16} style={{ color: 'var(--atomic-blue)' }} />
                <span>Start Execution</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Start
                </span>
              </Command.Item>
              <Command.Item
                value="stop execution"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Square size={16} style={{ color: '#ff1744' }} />
                <span>Stop Execution</span>
                <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Stop
                </span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="System" style={{
              padding: '8px 0',
              color: 'var(--text-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              <Command.Item
                value="refresh"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <RefreshCw size={16} style={{ color: 'var(--atomic-blue)' }} />
                <span>Refresh All</span>
              </Command.Item>
              <Command.Item
                value="clear-logs"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Trash2 size={16} style={{ color: '#ff1744' }} />
                <span>Clear Logs</span>
              </Command.Item>
              <Command.Item
                value="reset-budget"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Zap size={16} style={{ color: '#ffb800' }} />
                <span>Reset Budget</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Git" style={{
              padding: '8px 0',
              color: 'var(--text-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              <Command.Item
                value="git-status"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <GitBranch size={16} style={{ color: '#39ff14' }} />
                <span>Git Status</span>
              </Command.Item>
              <Command.Item
                value="git-push"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Upload size={16} style={{ color: '#39ff14' }} />
                <span>Git Push</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="State Control" style={{
              padding: '8px 0',
              color: 'var(--text-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600
            }}>
              <Command.Item
                value="set-state PLAN"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Activity size={16} style={{ color: '#00d4ff' }} />
                <span>Set State: PLAN</span>
              </Command.Item>
              <Command.Item
                value="set-state IMPLEMENT"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Activity size={16} style={{ color: '#ffb800' }} />
                <span>Set State: IMPLEMENT</span>
              </Command.Item>
              <Command.Item
                value="set-state VERIFY"
                onSelect={handleSelect}
                style={{
                  padding: '12px 16px',
                  borderRadius: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: 'var(--text-primary)',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                <Activity size={16} style={{ color: '#39ff14' }} />
                <span>Set State: VERIFY</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
