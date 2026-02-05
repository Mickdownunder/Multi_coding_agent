'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, GitBranch, Upload, Plus } from 'lucide-react'

function GitRemoteManager() {
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([])
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteName, setRemoteName] = useState('origin')
  const [branch, setBranch] = useState('main')
  const [pushing, setPushing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showCreateRepo, setShowCreateRepo] = useState(false)
  const [repoName, setRepoName] = useState('control-system')
  const [repoDescription, setRepoDescription] = useState('Control System - Autonomous Coding Agent')
  const [isPrivate, setIsPrivate] = useState(false)
  const [githubToken, setGithubToken] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchRemotes = async () => {
    try {
      const res = await fetch('/api/git/remote')
      const data = await res.json()
      if (res.ok) {
        setRemotes(data.remotes || [])
        if (data.remotes && data.remotes.length > 0) {
          setRemoteName(data.remotes[0].name)
        }
      }
    } catch (error) {
      console.error('Failed to fetch remotes:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRemotes()
  }, [])

  const handleAddRemote = async () => {
    if (!remoteUrl) {
      alert('Bitte URL eingeben (z.B. https://github.com/username/repo.git)')
      return
    }
    try {
      const res = await fetch('/api/git/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: remoteName, url: remoteUrl })
      })
      const data = await res.json()
      if (res.ok) {
        alert(`✅ Remote '${remoteName}' hinzugefügt!`)
        setRemoteUrl('')
        fetchRemotes()
      } else {
        alert(`Fehler: ${data.error}`)
      }
    } catch (error) {
      alert('Fehler beim Hinzufügen des Remotes')
    }
  }

  const handlePush = async () => {
    if (!remoteName) {
      alert('Bitte Remote auswählen oder hinzufügen')
      return
    }
    if (!confirm(`Zu ${remoteName}/${branch} pushen?`)) {
      return
    }
    setPushing(true)
    try {
      const res = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remote: remoteName, branch, url: remoteUrl || undefined })
      })
      const data = await res.json()
      if (res.ok) {
        alert(`✅ Erfolgreich zu ${remoteName}/${branch} gepusht!`)
        setRemoteUrl('')
      } else {
        alert(`Fehler: ${data.error}`)
      }
    } catch (error) {
      alert('Fehler beim Pushen')
    } finally {
      setPushing(false)
    }
  }

  if (loading) {
    return <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>$ Loading remotes...</div>
  }

  const handleCreateRepo = async () => {
    if (!repoName || !githubToken) {
      alert('Bitte Repository-Name und GitHub Token eingeben')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/git/create-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoName,
          description: repoDescription,
          isPrivate,
          githubToken
        })
      })
      const data = await res.json()
      if (res.ok) {
        alert(`✅ GitHub Repo '${repoName}' erstellt!\n\nURL: ${data.repository?.url || data.repoUrl}\n\nJetzt kannst du pushen!`)
        setGithubToken('')
        setShowCreateRepo(false)
        fetchRemotes()
        if (data.repoUrl) {
          setRemoteUrl(data.repoUrl)
        }
      } else {
        alert(`Fehler: ${data.error}\n\n${data.details || ''}`)
      }
    } catch (error) {
      alert('Fehler beim Erstellen des Repos')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{ marginTop: '12px', fontSize: '11px' }}>
      <div style={{ marginBottom: '8px', fontWeight: 600, color: 'var(--atomic-blue)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '10px' }}>
        Remote & Push
      </div>
      
      {!showCreateRepo && remotes.length === 0 && (
        <button
          onClick={() => setShowCreateRepo(true)}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '8px', fontSize: '11px', padding: '8px 12px' }}
        >
          <Plus size={12} style={{ marginRight: '6px', display: 'inline' }} />
          GitHub Repo erstellen
        </button>
      )}

      {showCreateRepo && (
        <div className="glass-surface" style={{ 
          padding: '16px', 
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          marginBottom: '12px' 
        }}>
          <div style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--atomic-blue)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px' }}>
            GitHub Repo erstellen
          </div>
          <input
            type="text"
            placeholder="Repository Name"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className="input-industrial"
            style={{ width: '100%', marginBottom: '8px', fontSize: '11px' }}
          />
          <input
            type="text"
            placeholder="Beschreibung (optional)"
            value={repoDescription}
            onChange={(e) => setRepoDescription(e.target.value)}
            className="input-industrial"
            style={{ width: '100%', marginBottom: '8px', fontSize: '11px' }}
          />
          <input
            type="password"
            placeholder="GitHub Personal Access Token"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            className="input-industrial"
            style={{ width: '100%', marginBottom: '8px', fontSize: '11px' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ accentColor: 'var(--atomic-blue)' }}
            />
            Privates Repository
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCreateRepo}
              disabled={creating || !repoName || !githubToken}
              className="btn-primary"
              style={{ flex: 1, fontSize: '11px', padding: '8px 12px' }}
            >
              {creating ? 'Creating...' : 'Create Repo'}
            </button>
            <button
              onClick={() => {
                setShowCreateRepo(false)
                setGithubToken('')
              }}
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '8px 12px' }}
            >
              Cancel
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'monospace' }}>
            Token: <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--atomic-blue)' }}>github.com/settings/tokens</a>
          </div>
        </div>
      )}
      
      {remotes.length > 0 && (
        <div style={{ marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Remotes:</strong>
          {remotes.map(r => (
            <div key={r.name} style={{ fontSize: '10px', marginTop: '4px', fontFamily: 'monospace', color: 'var(--atomic-blue)' }}>
              {r.name}: <code>{r.url}</code>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        <input
          type="text"
          placeholder="GitHub/GitLab URL"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
          className="input-industrial"
          style={{ width: '100%', marginBottom: '8px', fontSize: '11px' }}
        />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="Remote Name"
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            className="input-industrial"
            style={{ flex: 1, fontSize: '11px' }}
          />
          <input
            type="text"
            placeholder="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="input-industrial"
            style={{ flex: 1, fontSize: '11px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAddRemote}
            disabled={!remoteUrl}
            className="btn-secondary"
            style={{ flex: 1, fontSize: '11px', padding: '8px 12px' }}
          >
            Add Remote
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || remotes.length === 0}
            className="btn-primary"
            style={{ flex: 1, fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Upload size={12} />
            {pushing ? 'Pushing...' : 'Push'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FileLocationInfo() {
  const [gitStatus, setGitStatus] = useState<{ initialized: boolean; path: string } | null>(null)
  const [projectPath, setProjectPath] = useState<string>('')
  const [workspacePath, setWorkspacePath] = useState<string>('')
  const [isWorkspaceExternal, setIsWorkspaceExternal] = useState(false)

  const fetchData = async () => {
    const checkGit = async () => {
      try {
        const res = await fetch(`/api/git/status?t=${Date.now()}`)
        const data = await res.json()
        setGitStatus(data)
      } catch {
        setGitStatus({ initialized: false, path: '' })
      }
    }
    
    const getProjectPath = async () => {
      try {
        const res = await fetch(`/api/project/path?t=${Date.now()}`)
        const data = await res.json()
        if (res.ok && data.path) {
          setProjectPath(data.path)
          setWorkspacePath(data.workspacePath || data.path)
          setIsWorkspaceExternal(data.isWorkspaceExternal ?? false)
        }
      } catch {
        setProjectPath(window.location.origin.replace('http://localhost:', '').replace('http://', ''))
      }
    }
    
    await Promise.all([checkGit(), getProjectPath()])
  }

  useEffect(() => {
    fetchData()
    
    const handleRefresh = () => {
      fetchData()
    }
    window.addEventListener('dashboard-refresh', handleRefresh)
    
    return () => {
      window.removeEventListener('dashboard-refresh', handleRefresh)
    }
  }, [])

  const handleInitGit = async () => {
    try {
      const res = await fetch('/api/git/init', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setGitStatus({ initialized: true, path: data.path || '' })
        if (data.alreadyInitialized) {
          alert('Git Repository war bereits initialisiert!')
        } else {
          alert('Git Repository erfolgreich initialisiert!')
        }
      } else {
        alert(`Fehler: ${data.error}`)
      }
    } catch (error) {
      alert('Fehler beim Initialisieren von Git')
    }
  }

  return (
    <div className="card glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <h3 style={{ 
        marginBottom: '16px', 
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
        <FolderOpen size={18} style={{ color: 'var(--atomic-blue)' }} />
        File Location
      </h3>
      <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
          {isWorkspaceExternal
            ? 'Agent-Dateien werden im Workspace erstellt (control/config.json):'
            : 'Alle Dateien werden direkt in deinem Projektverzeichnis erstellt:'}
        </p>
        <div className="glass-surface" style={{ 
          padding: '12px', 
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '11px',
          marginBottom: '16px',
          color: 'var(--atomic-blue)',
          wordBreak: 'break-all'
        }}>
          {(isWorkspaceExternal ? workspacePath : projectPath) || '$ Loading...'}
        </div>
        {isWorkspaceExternal && (
          <p style={{ marginBottom: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
            Projekt (Dashboard): {projectPath}
          </p>
        )}
        <div className="glass-surface" style={{ 
          padding: '16px', 
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          marginBottom: '16px',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <strong style={{ color: 'var(--atomic-blue)', display: 'block', marginBottom: '8px' }}>
            So findest du den Documents-Ordner:
          </strong>
          <ol style={{ marginLeft: '20px', marginTop: '8px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
            <li><strong>Finder öffnen</strong> (Cmd+Space, dann "Finder")</li>
            <li>In der <strong>Seitenleiste</strong> auf <strong>"Dokumente"</strong> klicken</li>
            <li>Oder: <strong>Cmd+Shift+O</strong> drücken → öffnet direkt "Dokumente"</li>
            <li>Dort findest du den Ordner <code style={{ color: 'var(--atomic-blue)', fontFamily: 'monospace' }}>control-system</code></li>
          </ol>
          <p style={{ marginTop: '12px', color: 'var(--success-emerald)', fontFamily: 'monospace', fontSize: '10px' }}>
            $ Tipp: Pfad kopieren und im Finder einfügen (Cmd+Shift+G)
          </p>
        </div>
        <p style={{ marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
          Beispiele:
        </p>
        <ul style={{ marginLeft: '20px', marginBottom: '16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
          <li><code style={{ color: 'var(--atomic-blue)' }}>app/components/todo/TodoItem.tsx</code></li>
          <li><code style={{ color: 'var(--atomic-blue)' }}>app/api/todos/route.ts</code></li>
          <li><code style={{ color: 'var(--atomic-blue)' }}>lib/todo-store.ts</code></li>
          <li><code style={{ color: 'var(--atomic-blue)' }}>types/todo.ts</code></li>
        </ul>
        
        <div className="glass-surface" style={{ 
          padding: '16px', 
          border: '1px solid var(--border-subtle)',
          borderRadius: 0,
          marginTop: '16px',
          marginBottom: '16px'
        }}>
          <div style={{ marginBottom: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GitBranch size={14} style={{ color: 'var(--cyber-lime)' }} />
            Git Integration
          </div>
          {gitStatus?.initialized ? (
            <div>
              <div style={{ color: 'var(--success-emerald)', marginBottom: '12px', fontFamily: 'monospace', fontSize: '11px' }}>
                $ Git Repository initialisiert
                {gitStatus.path && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {gitStatus.path}
                  </div>
                )}
              </div>
              <GitRemoteManager />
            </div>
          ) : (
            <div>
              <div style={{ color: 'var(--warning-amber)', marginBottom: '12px', fontFamily: 'monospace', fontSize: '11px' }}>
                $ Git Repository nicht initialisiert
              </div>
              <button
                onClick={handleInitGit}
                className="btn-primary"
                style={{ fontSize: '11px', padding: '8px 16px' }}
              >
                Initialize Git
              </button>
            </div>
          )}
        </div>

        <p style={{ color: 'var(--success-emerald)', marginTop: '16px', fontFamily: 'monospace', fontSize: '11px' }}>
          $ Dateien sind sofort im Editor/IDE sichtbar!
        </p>
        <p style={{ color: 'var(--warning-amber)', marginTop: '8px', fontFamily: 'monospace', fontSize: '11px' }}>
          $ Tipp: Öffne das Projektverzeichnis in deinem Editor
        </p>
      </div>
    </div>
  )
}
