'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { DashboardLayout } from '@/components/DashboardLayout';
import IntentAssistant from './components/IntentAssistant';
import ExecutionStatus from './components/ExecutionStatus';
import ExecutionLogs from './components/ExecutionLogs';
import TokenBudgetTracker from './components/TokenBudgetTracker';
import LiveFiles from './components/LiveFiles';
import FileLocationInfo from './components/FileLocationInfo';
import CommandBar from './components/CommandBar';

const ARTIFACT_FILES = ['intent.md', 'rules.md', 'plan.md', 'report.md'] as const;

export default function Page() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentState, setCurrentState] = useState<string>('PLAN');
  const [artifacts, setArtifacts] = useState<Record<string, string>>({});
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch state
  const fetchState = useCallback(async (silent = false) => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (res.ok && data.state !== currentState) {
        setCurrentState(data.state);
      }
    } catch (error) {
      if (!silent) {
        console.error('Failed to fetch state:', error);
      }
    }
  }, [currentState]);

  // Fetch file content
  const fetchFile = useCallback(async (filename: string, silent = false) => {
    try {
      const res = await fetch(`/api/files?name=${filename}`);
      const data = await res.json();
      if (res.ok) {
        // Only update if content actually changed to prevent unnecessary re-renders
        if (data.content !== artifacts[filename]) {
          setArtifacts(prev => ({ ...prev, [filename]: data.content || '' }));
        }
      }
    } catch (error) {
      if (!silent) {
        console.error(`Failed to fetch ${filename}:`, error);
      }
    }
  }, [artifacts]);

  // Fetch all data - does NOT dispatch events to avoid infinite loops
  const fetchAll = useCallback(async (silent = false) => {
    await fetchState(silent);
    await Promise.all(ARTIFACT_FILES.map(f => fetchFile(f, silent)));
    setLastRefresh(Date.now());
  }, [fetchState, fetchFile]);

  // Trigger refresh for all components (used by buttons)
  const triggerGlobalRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchAll(false);
      // Dispatch event for other components (they don't call fetchAll, so no loop)
      window.dispatchEvent(new Event('dashboard-refresh'));
    } finally {
      // Small delay so user sees the refresh indicator
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [fetchAll]);

  // Initial fetch and setup
  useEffect(() => {
    fetchAll(false);
    
    // Listen for global refresh events (from IntentAssistant, etc.)
    const handleGlobalRefresh = () => {
      fetchAll(false);
    };
    window.addEventListener('dashboard-refresh', handleGlobalRefresh);
    
    // Poll every 5 seconds if execution is active
    const poll = () => {
      if (currentState && currentState !== 'PLAN' && currentState !== 'DONE' && currentState !== 'FAIL') {
        fetchAll(true);
      }
    };
    const interval = setInterval(poll, 5000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('dashboard-refresh', handleGlobalRefresh);
    };
  }, [fetchAll, currentState]);

  // Handle file edit
  const handleEdit = (filename: string) => {
    setEditingFile(filename);
    setEditContent(artifacts[filename] || '');
  };

  // Handle save
  const handleSave = async () => {
    if (!editingFile) return;
    
    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: editingFile,
          content: editContent
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to save file');
        return;
      }
      
      setEditingFile(null);
      triggerGlobalRefresh();
    } catch (error) {
      alert('Failed to save file');
    }
  };

  // Render dashboard tab
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Current State */}
      <section className="card glass-card p-6">
        <h3 className="text-lg font-bold mb-4" style={{ 
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontFamily: 'Inter, sans-serif'
        }}>Current State</h3>
        <div className="flex items-center gap-4">
          <div className={`status-badge status-${currentState.toLowerCase()}`}>
            {currentState}
          </div>
          {(currentState === 'PLAN' || currentState === 'DONE' || currentState === 'FAIL') && (
            <p className="text-sm" style={{ 
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}>
              {currentState === 'PLAN' && 'Ready to start execution'}
              {currentState === 'DONE' && 'Execution completed successfully'}
              {currentState === 'FAIL' && 'Execution failed - check logs'}
            </p>
          )}
        </div>
      </section>

      {/* Artifacts */}
      <section className="card glass-card p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold" style={{ 
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontFamily: 'Inter, sans-serif'
          }}>Control Files</h3>
          <button
            onClick={async () => {
              if (!confirm('Alle Dateien außer rules.md löschen?\n\n- Control-Dateien (intent.md, plan.md, report.md, state.txt)\n- Alle erstellten App-Dateien (apps/{app-name}/)')) {
                return
              }
              setIsRefreshing(true)
              try {
                // Clear control files
                const res = await fetch('/api/files/clear', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
                })
                
                // Clear all created app files
                const clearAllRes = await fetch('/api/files/clear-all', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirm: true })
                })
                
                if (res.ok && clearAllRes.ok) {
                  const clearData = await clearAllRes.json()
                  // Clear local state
                  setArtifacts({})
                  setCurrentState('PLAN')
                  // Refresh to show empty state
                  await fetchAll(false)
                  window.dispatchEvent(new Event('dashboard-refresh'))
                  
                  if (clearData.deleted && clearData.deleted.length > 0) {
                    alert(`✅ Gelöscht:\n- Control-Dateien\n- ${clearData.deleted.length} App-Datei(en)`)
                  } else {
                    alert('✅ Control-Dateien gelöscht')
                  }
                } else {
                  const data = await res.json()
                  alert(data.error || 'Failed to clear files')
                }
              } catch (error) {
                console.error('Failed to clear files:', error)
                alert('Failed to clear files')
              } finally {
                setIsRefreshing(false)
              }
            }}
            disabled={isRefreshing}
            className="btn-secondary"
            style={{ 
              padding: '8px 16px',
              fontSize: '11px',
              opacity: isRefreshing ? 0.7 : 1,
              cursor: isRefreshing ? 'not-allowed' : 'pointer'
            }}
          >
            {isRefreshing ? 'Clearing...' : 'Clear All'}
          </button>
        </div>
        
        <div className="space-y-4">
          {ARTIFACT_FILES.map(filename => {
            const content = artifacts[filename] || '';
            const isEditable = filename === 'intent.md' || filename === 'rules.md';
            
            return (
              <div 
                key={filename} 
                className="rounded-lg p-4"
                style={{ 
                  background: '#0f172a',
                  border: '1px solid #334155'
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold" style={{ color: '#f1f5f9' }}>{filename}</h4>
                  {isEditable && !editingFile && (
                    <button
                      onClick={() => handleEdit(filename)}
                      className="px-3 py-1 rounded text-sm font-medium transition-all"
                      style={{ 
                        background: '#334155',
                        color: '#60a5fa',
                        border: '1px solid #475569'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#475569';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#334155';
                        e.currentTarget.style.borderColor = '#475569';
                      }}
                    >
                      Edit
                    </button>
                  )}
                </div>
                
                {editingFile === filename ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full h-64 p-3 rounded font-mono text-sm"
                      style={{ 
                        background: '#0f172a',
                        border: '1px solid #334155',
                        color: '#f1f5f9'
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded-lg font-medium transition-all"
                        style={{ 
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-1px)';
                          e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingFile(null)}
                        className="px-4 py-2 rounded-lg font-medium transition-all"
                        style={{ 
                          background: '#334155',
                          color: '#cbd5e1',
                          border: '1px solid #475569'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#475569';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#334155';
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    {content ? (
                      <ReactMarkdown>{content}</ReactMarkdown>
                    ) : (
                      <p className="italic" style={{ color: '#64748b' }}>File not found or empty</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  // Render assistant tab
  const renderAssistant = () => (
    <IntentAssistant />
  );

  // Render monitor tab
  const renderMonitor = () => (
    <div className="space-y-6">
      <ExecutionStatus />
      <ExecutionLogs />
      <TokenBudgetTracker />
    </div>
  );

  // Render files tab
  const renderFiles = () => (
    <div className="space-y-6">
      <FileLocationInfo />
      <LiveFiles />
    </div>
  );

  return (
    <>
      <CommandBar />
      <DashboardLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'assistant' && renderAssistant()}
        {activeTab === 'monitor' && renderMonitor()}
        {activeTab === 'files' && renderFiles()}
      </DashboardLayout>
    </>
  );
}
