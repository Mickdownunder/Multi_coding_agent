'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, GitBranch, Cpu, Zap, Clock } from 'lucide-react'

interface Status {
  state: string
  running: boolean
  idle?: boolean
  currentStep?: string
  lastUpdate: string
  progress?: {
    completedSteps: string[]
    totalSteps?: number
    progressPercent?: number
  }
}

interface Telemetry {
  tokenBurnRate: number
  gitHash: string
  gitBranch: string
  cpuLoad: number
  memoryUsage: number
  runtime: string
}

const STATES = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE', 'FAIL']

export default function ExecutionStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  const [telemetry, setTelemetry] = useState<Telemetry>({
    tokenBurnRate: 0,
    gitHash: 'N/A',
    gitBranch: 'main',
    cpuLoad: 0,
    memoryUsage: 0,
    runtime: '00:00:00'
  })
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previousState, setPreviousState] = useState<string | null>(null)
  const startTimeRef = useRef<Date | null>(null)

  const fetchStatus = async () => {
    try {
      const statusRes = await fetch('/api/execute/status')
      const statusData = await statusRes.json()
      
      // Detect state change for animation
      if (status?.state && status.state !== statusData.state) {
        setPreviousState(status.state)
      }
      
      // UI-WAHRHEIT: state.txt ist einzige Quelle, FAIL/DONE/PLAN = nicht running
      const isRunning = statusData.running && !statusData.idle && 
                       statusData.state !== 'FAIL' && 
                       statusData.state !== 'DONE' && 
                       statusData.state !== 'PLAN'
      
      setStatus({
        state: statusData.state || 'UNKNOWN',
        running: isRunning,
        idle: statusData.idle || false,
        lastUpdate: new Date().toLocaleTimeString(),
        progress: statusData.progress
      })

      // UI-WAHRHEIT: Start timer nur wenn wirklich running (nicht FAIL/DONE/PLAN)
      const isActuallyRunning = isRunning
      
      if (isActuallyRunning && !startTimeRef.current) {
        startTimeRef.current = new Date()
      } else if (!isActuallyRunning) {
        startTimeRef.current = null
      }

      // Fetch telemetry
      try {
        const budgetRes = await fetch('/api/execute/budget')
        const budgetData = await budgetRes.json()
        
        // Simulate token burn rate (in real implementation, calculate from recent usage)
        const burnRate = Math.floor(Math.random() * 300) + 50 // Simulated
        
        // Fetch Git info
        let gitHash = 'N/A'
        let gitBranch = 'main'
        try {
          const gitRes = await fetch('/api/git/status')
          const gitData = await gitRes.json()
          gitHash = gitData.hash || 'N/A'
          gitBranch = gitData.branch || 'main'
        } catch (error) {
          // Ignore Git errors
        }
        
        // Simulate CPU/Memory (in real implementation, get from system)
        const cpuLoad = statusData.running ? Math.floor(Math.random() * 40) + 20 : 5
        const memoryUsage = statusData.running ? Math.floor(Math.random() * 30) + 15 : 8

        // Calculate runtime
        let runtime = '00:00:00'
        if (startTimeRef.current) {
          const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000)
          const hours = Math.floor(elapsed / 3600)
          const minutes = Math.floor((elapsed % 3600) / 60)
          const seconds = elapsed % 60
          runtime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        }

        setTelemetry({
          tokenBurnRate: burnRate,
          gitHash: gitHash?.substring(0, 7) || 'N/A',
          gitBranch: gitBranch,
          cpuLoad,
          memoryUsage,
          runtime
        })
      } catch (error) {
        // Ignore telemetry errors
      }
      
      setError(null)
    } catch (error) {
      console.error('Failed to fetch status:', error)
      setError('Failed to load execution status')
    }
  }

  useEffect(() => {
    fetchStatus()
    
    const handleRefresh = () => {
      fetchStatus()
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    // UI-WAHRHEIT: Alle 5 Sekunden Status abfragen, state.txt ist einzige Quelle
    const poll = async () => {
      try {
        const statusRes = await fetch(`/api/execute/status?t=${Date.now()}`)
        const statusData = await statusRes.json()
        
        // UI-WAHRHEIT: Wenn Backend 'idle' oder state.txt = FAIL/DONE, sofort auf 0/Inaktiv setzen
        if (statusData.idle || statusData.state === 'FAIL' || statusData.state === 'DONE' || statusData.state === 'PLAN') {
          // Setze alle Anzeigen auf 0/Inaktiv
          setTelemetry(prev => ({
            ...prev,
            tokenBurnRate: 0,
            cpuLoad: 0,
            memoryUsage: 0
          }))
          if (statusData.state === 'FAIL' || statusData.state === 'DONE' || statusData.state === 'PLAN') {
            startTimeRef.current = null
          }
        }
        
        // Aktualisiere Status (auch wenn idle)
        setStatus(prev => ({
          ...prev,
          state: statusData.state || 'UNKNOWN',
          running: statusData.running || false,
          lastUpdate: new Date().toLocaleTimeString(),
          progress: statusData.progress
        }))
      } catch (error) {
        // Bei Fehler: Setze auf idle
        setStatus(prev => prev ? {
          ...prev,
          running: false,
          state: 'UNKNOWN',
          lastUpdate: new Date().toLocaleTimeString()
        } : {
          state: 'UNKNOWN',
          running: false,
          lastUpdate: new Date().toLocaleTimeString()
        })
        setTelemetry(prev => ({
          ...prev,
          tokenBurnRate: 0,
          cpuLoad: 0,
          memoryUsage: 0
        }))
      }
    }
    
    // UI-WAHRHEIT: Alle 5 Sekunden Status prüfen
    const interval = setInterval(poll, 5000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [])

  // Update runtime every second when running
  useEffect(() => {
    if (!status?.running || !startTimeRef.current) return

    const timer = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Math.floor((new Date().getTime() - startTimeRef.current.getTime()) / 1000)
        const hours = Math.floor(elapsed / 3600)
        const minutes = Math.floor((elapsed % 3600) / 60)
        const seconds = elapsed % 60
        const runtime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        setTelemetry(prev => ({ ...prev, runtime }))
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [status?.running])

  const handleStart = async () => {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/execute/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to start execution')
      } else {
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
        setTimeout(() => fetchStatus(), 1000)
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setStopping(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('Reset to PLAN?\n\nThis will:\n- Clear all locks\n- Flush execution queue\n- Reset state to PLAN\n\nYou can then resume from where you left off (completed steps are preserved).')) {
      return
    }
    
    setResetting(true)
    setError(null)
    try {
      const res = await fetch('/api/execute/reset', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to reset execution')
      } else {
        // Trigger global refresh
        window.dispatchEvent(new Event('dashboard-refresh'))
        setTimeout(() => fetchStatus(), 1000)
      }
    } catch (error) {
      setError('Failed to connect to server')
    } finally {
      setResetting(false)
    }
  }

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'PLAN': return '#00d4ff'
      case 'IMPLEMENT': return '#ffb800'
      case 'VERIFY': return '#39ff14'
      case 'DONE': return '#00ff88'
      case 'FAIL': return '#ff1744'
      default: return '#64748b'
    }
  }

  const getStateGlow = (state: string): string => {
    const color = getStateColor(state)
    return `0 0 20px ${color}40, 0 0 40px ${color}20`
  }

  const currentStateIndex = STATES.indexOf(status?.state || 'PLAN')
  const isActive = status?.running && status.state !== 'DONE' && status.state !== 'FAIL'

  return (
    <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '18px', 
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif'
        }}>
          Mission Control
        </h2>
        {status?.running && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#00ff88',
              borderRadius: '50%',
              boxShadow: '0 0 10px #00ff88',
              animation: 'pulse 2s ease-in-out infinite'
            }} />
            <span style={{ 
              color: '#00ff88', 
              fontSize: '11px', 
              fontFamily: 'monospace',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              ACTIVE
            </span>
          </div>
        )}
      </div>

      {/* State Machine Timeline */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ 
          fontSize: '11px', 
          color: 'var(--text-muted)', 
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'monospace'
        }}>
          State Machine
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          position: 'relative'
        }}>
          {STATES.map((state, index) => {
            const isCurrent = status?.state === state
            const isPast = currentStateIndex > index
            const isFuture = currentStateIndex < index
            
            return (
              <div key={state} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <AnimatePresence mode="wait">
                  {isCurrent && (
                    <motion.div
                      key={state}
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ 
                        scale: [1, 1.1, 1.05, 1],
                        boxShadow: [
                          `0 0 10px ${getStateColor(state)}40`,
                          `0 0 30px ${getStateColor(state)}60`,
                          `0 0 20px ${getStateColor(state)}40`,
                          `0 0 10px ${getStateColor(state)}40`
                        ]
                      }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                      style={{
                        padding: '8px 16px',
                        background: isPast || isCurrent ? getStateColor(state) : 'transparent',
                        border: `2px solid ${getStateColor(state)}`,
                        color: isCurrent || isPast ? '#0b0f1a' : getStateColor(state),
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '11px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        borderRadius: 0,
                        boxShadow: isCurrent ? getStateGlow(state) : 'none',
                        minWidth: '100px',
                        textAlign: 'center'
                      }}
                    >
                      {state}
                    </motion.div>
                  )}
                </AnimatePresence>
                {!isCurrent && (
                  <div
                    style={{
                      padding: '8px 16px',
                      background: isPast ? getStateColor(state) : 'transparent',
                      border: `2px solid ${getStateColor(state)}`,
                      color: isPast ? '#0b0f1a' : getStateColor(state),
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1.5px',
                      borderRadius: 0,
                      opacity: isFuture ? 0.3 : 1,
                      minWidth: '100px',
                      textAlign: 'center'
                    }}
                  >
                    {state}
                  </div>
                )}
                {index < STATES.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: '2px',
                    background: isPast || (isCurrent && index === currentStateIndex - 1) 
                      ? getStateColor(STATES[index + 1]) 
                      : 'var(--border-subtle)',
                    margin: '0 8px',
                    opacity: isFuture ? 0.3 : 1
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Telemetry Dashboard */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Current State */}
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Current State
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: getStateColor(status?.state || 'UNKNOWN'),
            fontFamily: 'JetBrains Mono, monospace',
            textShadow: `0 0 10px ${getStateColor(status?.state || 'UNKNOWN')}40`
          }}>
            {status?.state || 'UNKNOWN'}
          </div>
        </div>

        {/* Progress */}
        {status?.progress && status.progress.totalSteps !== undefined && (
          <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Progress
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#00ff88',
              fontFamily: 'JetBrains Mono, monospace',
              marginBottom: '4px'
            }}>
              {status.progress.progressPercent || 0}%
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {status.progress.completedSteps.length} / {status.progress.totalSteps} steps
            </div>
          </div>
        )}

        {/* Token Burn Rate */}
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Zap size={10} /> Token Burn Rate
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: telemetry.tokenBurnRate > 200 ? '#ffb800' : '#00d4ff',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '4px'
          }}>
            {telemetry.tokenBurnRate}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            tokens/sec
          </div>
        </div>

        {/* Git Hash */}
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <GitBranch size={10} /> Git
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: '#39ff14',
            fontFamily: 'JetBrains Mono, monospace',
            marginBottom: '4px'
          }}>
            {telemetry.gitHash}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {telemetry.gitBranch}
          </div>
        </div>

        {/* CPU Load */}
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={10} /> CPU Load
          </div>
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-void)',
              border: '1px solid var(--border-subtle)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${telemetry.cpuLoad}%` }}
                transition={{ duration: 0.5 }}
                style={{
                  height: '100%',
                  background: telemetry.cpuLoad > 70 ? '#ffb800' : '#00d4ff',
                  boxShadow: `0 0 10px ${telemetry.cpuLoad > 70 ? '#ffb800' : '#00d4ff'}40`
                }}
              />
            </div>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: telemetry.cpuLoad > 70 ? '#ffb800' : '#00d4ff',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {telemetry.cpuLoad}%
          </div>
        </div>

        {/* Runtime */}
        <div className="glass-surface" style={{ padding: '16px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} /> Runtime
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#00d4ff',
            fontFamily: 'JetBrains Mono, monospace'
          }}>
            {telemetry.runtime}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
        {!status?.running ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="btn-primary"
          >
            {starting ? 'Starting...' : 'Start Execution'}
          </button>
        ) : (
          <button
            onClick={handleStop}
            disabled={stopping}
            className="btn-danger"
          >
            {stopping ? 'Stopping...' : 'Stop Execution'}
          </button>
        )}
        
        {/* UI-UNLOCK: Reset to PLAN button (shown when in FAIL or DONE state) */}
        {(status?.state === 'FAIL' || status?.state === 'DONE') && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn-secondary"
            style={{
              background: 'var(--warning-amber)',
              color: 'var(--bg-void)',
              border: 'none'
            }}
          >
            {resetting ? 'Resetting...' : 'Reset to PLAN'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ 
          background: 'rgba(255, 23, 68, 0.2)', 
          border: '1px solid #ff1744',
          color: '#ff1744', 
          padding: '12px', 
          marginTop: '16px',
          fontSize: '12px',
          fontFamily: 'monospace'
        }}>
          {error}
        </div>
      )}
    </div>
  )
}
