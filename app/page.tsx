'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'

type State = 'PLAN' | 'IMPLEMENT' | 'VERIFY' | 'DONE' | 'FAIL'
const VALID_STATES: State[] = ['PLAN', 'IMPLEMENT', 'VERIFY', 'DONE']

type FileData = {
  content: string | null
  error: string | null
  loading: boolean
}

type EditState = {
  isEditing: boolean
  draft: string
  saving: boolean
}

const ARTIFACT_FILES = ['intent.md', 'rules.md', 'plan.md', 'report.md'] as const
const EDITABLE_FILES = ['intent.md', 'rules.md'] as const

export default function Dashboard() {
  // State management
  const [currentState, setCurrentState] = useState<string | null>(null)
  const [stateError, setStateError] = useState<string | null>(null)
  const [stateLoading, setStateLoading] = useState(true)
  const [settingState, setSettingState] = useState<string | null>(null)

  // Files data
  const [files, setFiles] = useState<Record<string, FileData>>(() => {
    const initial: Record<string, FileData> = {}
    ARTIFACT_FILES.forEach(f => {
      initial[f] = { content: null, error: null, loading: true }
    })
    return initial
  })

  // Edit states for editable files
  const [editStates, setEditStates] = useState<Record<string, EditState>>(() => {
    const initial: Record<string, EditState> = {}
    EDITABLE_FILES.forEach(f => {
      initial[f] = { isEditing: false, draft: '', saving: false }
    })
    return initial
  })

  // Fetch current state
  const fetchState = useCallback(async () => {
    setStateLoading(true)
    setStateError(null)
    try {
      const res = await fetch('/api/state')
      const data = await res.json()
      if (!res.ok) {
        setStateError(data.error || 'Failed to fetch state')
        setCurrentState(null)
      } else {
        setCurrentState(data.state)
      }
    } catch {
      setStateError('Failed to connect to server')
      setCurrentState(null)
    } finally {
      setStateLoading(false)
    }
  }, [])

  // Fetch a single file
  const fetchFile = useCallback(async (filename: string) => {
    setFiles(prev => ({
      ...prev,
      [filename]: { ...prev[filename], loading: true, error: null }
    }))
    try {
      const res = await fetch(`/api/files?name=${encodeURIComponent(filename)}`)
      const data = await res.json()
      if (!res.ok) {
        setFiles(prev => ({
          ...prev,
          [filename]: { content: null, error: data.error || 'Failed to fetch', loading: false }
        }))
      } else {
        setFiles(prev => ({
          ...prev,
          [filename]: { content: data.content, error: null, loading: false }
        }))
      }
    } catch {
      setFiles(prev => ({
        ...prev,
        [filename]: { content: null, error: 'Failed to connect', loading: false }
      }))
    }
  }, [])

  // Fetch all data
  const fetchAll = useCallback(() => {
    fetchState()
    ARTIFACT_FILES.forEach(f => fetchFile(f))
  }, [fetchState, fetchFile])

  // Initial fetch
  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Set state
  const handleSetState = async (newState: State) => {
    setSettingState(newState)
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: newState })
      })
      if (res.ok) {
        setCurrentState(newState)
        setStateError(null)
      } else {
        const data = await res.json()
        setStateError(data.error || 'Failed to set state')
      }
    } catch {
      setStateError('Failed to connect to server')
    } finally {
      setSettingState(null)
    }
  }

  // Start editing
  const handleEdit = (filename: string) => {
    const fileData = files[filename]
    if (fileData.content !== null) {
      setEditStates(prev => ({
        ...prev,
        [filename]: { isEditing: true, draft: fileData.content!, saving: false }
      }))
    }
  }

  // Cancel editing
  const handleCancelEdit = (filename: string) => {
    setEditStates(prev => ({
      ...prev,
      [filename]: { isEditing: false, draft: '', saving: false }
    }))
  }

  // Save file
  const handleSave = async (filename: string) => {
    const editState = editStates[filename]
    setEditStates(prev => ({
      ...prev,
      [filename]: { ...prev[filename], saving: true }
    }))

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content: editState.draft })
      })
      if (res.ok) {
        setFiles(prev => ({
          ...prev,
          [filename]: { content: editState.draft, error: null, loading: false }
        }))
        setEditStates(prev => ({
          ...prev,
          [filename]: { isEditing: false, draft: '', saving: false }
        }))
      } else {
        const data = await res.json()
        alert(`Failed to save: ${data.error}`)
        setEditStates(prev => ({
          ...prev,
          [filename]: { ...prev[filename], saving: false }
        }))
      }
    } catch {
      alert('Failed to connect to server')
      setEditStates(prev => ({
        ...prev,
        [filename]: { ...prev[filename], saving: false }
      }))
    }
  }

  // Update draft
  const handleDraftChange = (filename: string, value: string) => {
    setEditStates(prev => ({
      ...prev,
      [filename]: { ...prev[filename], draft: value }
    }))
  }

  const isEditable = (filename: string): filename is typeof EDITABLE_FILES[number] => {
    return (EDITABLE_FILES as readonly string[]).includes(filename)
  }

  return (
    <div className="dashboard">
      <div className="header-row">
        <h1>Control Dashboard</h1>
        <button className="refresh-btn" onClick={fetchAll}>
          Refresh
        </button>
      </div>

      {/* Status Section */}
      <section className="status-section">
        <h2>Current State</h2>
        {stateLoading ? (
          <div className="loading">Loading...</div>
        ) : stateError ? (
          <div className="error">{stateError}</div>
        ) : (
          <div className={`state-display state-${currentState || 'unknown'}`}>
            {currentState || 'UNKNOWN'}
          </div>
        )}

        <div className="state-controls">
          {VALID_STATES.map(state => (
            <button
              key={state}
              className={`state-btn ${currentState === state ? 'active' : ''}`}
              onClick={() => handleSetState(state)}
              disabled={settingState !== null || currentState === state}
            >
              {settingState === state ? '...' : state}
            </button>
          ))}
        </div>
      </section>

      {/* Artifacts Grid */}
      <section>
        <h2>Control Files</h2>
        <div className="artifacts-grid">
          {ARTIFACT_FILES.map(filename => {
            const fileData = files[filename]
            const editState = editStates[filename]
            const canEdit = isEditable(filename)

            return (
              <div key={filename} className="artifact-card">
                <h3>
                  {filename}
                  {canEdit && !editState?.isEditing && fileData.content !== null && (
                    <button className="edit-btn" onClick={() => handleEdit(filename)}>
                      Edit
                    </button>
                  )}
                </h3>

                {fileData.loading ? (
                  <div className="loading">Loading...</div>
                ) : fileData.error ? (
                  <div className="error">{fileData.error}</div>
                ) : editState?.isEditing ? (
                  <div>
                    <textarea
                      className="edit-textarea"
                      value={editState.draft}
                      onChange={e => handleDraftChange(filename, e.target.value)}
                      disabled={editState.saving}
                    />
                    <div className="edit-actions">
                      <button
                        className="save-btn"
                        onClick={() => handleSave(filename)}
                        disabled={editState.saving}
                      >
                        {editState.saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => handleCancelEdit(filename)}
                        disabled={editState.saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="artifact-content">
                    <ReactMarkdown>{fileData.content || ''}</ReactMarkdown>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
