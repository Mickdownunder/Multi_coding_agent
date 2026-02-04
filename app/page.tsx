 
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  MessageSquare, 
  Settings, 
  Activity, 
  Play, 
  Square, 
  RefreshCw, 
  AlertCircle,
  ShieldCheck,
  Coins
} from 'lucide-react'
import ChatInterface from '@/components/assistant/ChatInterface'
import ControlInterface from '@/components/assistant/ControlInterface'
import MonitorInterface from '@/components/assistant/MonitorInterface'
import { StatusResponse, BudgetResponse, LogEntry, CreatedFile } from '@/types/api'

export default function ControlSystemPage() {
  // Tab State
  const [activeTab, setActiveTab] = useState<'assistant' | 'control' | 'monitor'>('assistant')

  // Execution State
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [budget, setBudget] = useState<BudgetResponse | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [files, setFiles] = useState<CreatedFile[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Polling for updates
  const fetchData = useCallback(async () => {
    try {
      const [statusRes, budgetRes, logsRes, filesRes] = await Promise.all([
        fetch('/api/execute/status').then(res => res.json()),
        fetch('/api/execute/budget').then(res => res.json()),
        fetch('/api/execute/logs?lines=50').then(res => res.json()),
        fetch('/api/execute/files').then(res => res.json())
      ])

      setStatus(statusRes)
      setBudget(budgetRes)
      setLogs(logsRes.logs || [])
      setFiles(filesRes.files || [])
      setError(null)
    } catch (err) {
      console.error('Failed to fetch system status:', err)
      setError('Connection to backend lost')
    }
  }, [])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleStartExecution = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/execute/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start')
      setActiveTab('monitor')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsRefreshing(false)
      fetchData()
    }
  }

  const handleStopExecution = async () => {
    setIsRefreshing(true)
    try {
      await fetch('/api/execute/stop', { method: 'POST' })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsRefreshing(false)
      fetchData()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900">
      {/* Header / Navigation */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">AI Control System</h1>
        </div>

        <nav className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('assistant')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'assistant' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Assistant
          </button>
          <button
            onClick={() => setActiveTab('control')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'control' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Settings className="w-4 h-4" />
            Control
          </button>
          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'monitor' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Activity className="w-4 h-4" />
            Monitor
          </button>
        </nav>

        <div className="flex items-center gap-4">
          {/* Global Status Indicators */}
          <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
             <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-mono">${budget?.totalCost?.toFixed(4) || '0.0000'}</span>
             </div>
             <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${status?.running ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className="text-xs font-bold uppercase tracking-wider">{status?.state || 'IDLE'}</span>
             </div>
          </div>

          {status?.running ? (
            <button
              onClick={handleStopExecution}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium"
            >
              <Square className="w-4 h-4 fill-current" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleStartExecution}
              disabled={isRefreshing || !status || status.state === 'DONE'}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 font-medium"
            >
              <Play className="w-4 h-4 fill-current" />
              Start Execution
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-full shadow-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="h-full w-full max-w-[1600px] mx-auto p-6 overflow-hidden flex flex-col">
          {activeTab === 'assistant' && (
            <ChatInterface onIntentGenerated={() => setActiveTab('control')} />
          )}
          
          {activeTab === 'control' && (
            <ControlInterface />
          )}

          {activeTab === 'monitor' && (
            <MonitorInterface 
              status={status} 
              logs={logs} 
              files={files} 
              budget={budget} 
            />
          )}
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="px-6 py-2 bg-white border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
        <div className="flex gap-4">
          <span>Engine: v1.0.0</span>
          <span>State: {status?.state || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Auto-sync active</span>
        </div>
      </footer>
    </div>
  )
}
