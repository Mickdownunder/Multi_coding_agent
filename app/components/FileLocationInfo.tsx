'use client'

import { useState, useEffect } from 'react'

function GitRemoteManager() {
  const [remotes, setRemotes] = useState<Array<{ name: string; url: string }>>([])
  const [remoteUrl, setRemoteUrl] = useState('')
  const [remoteName, setRemoteName] = useState('origin')
  const [branch, setBranch] = useState('main')
  const [pushing, setPushing] = useState(false)
  const [loading, setLoading] = useState(true)

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
    return <div style={{ fontSize: '11px', color: '#888' }}>Lade Remotes...</div>
  }

  return (
    <div style={{ marginTop: '12px', fontSize: '11px' }}>
      <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#5c9aff' }}>📤 Remote & Push:</div>
      
      {remotes.length > 0 && (
        <div style={{ marginBottom: '8px', color: '#aaa' }}>
          <strong>Remotes:</strong>
          {remotes.map(r => (
            <div key={r.name} style={{ fontSize: '10px', marginTop: '4px' }}>
              {r.name}: <code style={{ color: '#5c9aff' }}>{r.url}</code>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '8px' }}>
        <input
          type="text"
          placeholder="GitHub/GitLab URL (z.B. https://github.com/user/repo.git)"
          value={remoteUrl}
          onChange={(e) => setRemoteUrl(e.target.value)}
          style={{
            width: '100%',
            padding: '4px 8px',
            background: '#2a2a2a',
            color: '#e0e0e0',
            border: '1px solid #444',
            borderRadius: '4px',
            fontSize: '10px',
            marginBottom: '6px'
          }}
        />
        <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
          <input
            type="text"
            placeholder="Remote Name"
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: '#2a2a2a',
              color: '#e0e0e0',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          />
          <input
            type="text"
            placeholder="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            style={{
              flex: 1,
              padding: '4px 8px',
              background: '#2a2a2a',
              color: '#e0e0e0',
              border: '1px solid #444',
              borderRadius: '4px',
              fontSize: '10px'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleAddRemote}
            disabled={!remoteUrl}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: remoteUrl ? '#5c9aff' : '#444',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: remoteUrl ? 'pointer' : 'not-allowed',
              opacity: remoteUrl ? 1 : 0.6
            }}
          >
            Remote hinzufügen
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || remotes.length === 0}
            style={{
              flex: 1,
              padding: '6px 12px',
              background: (pushing || remotes.length === 0) ? '#444' : '#7ec87e',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              cursor: (pushing || remotes.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (pushing || remotes.length === 0) ? 0.6 : 1
            }}
          >
            {pushing ? 'Pushe...' : 'Push'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FileLocationInfo() {
  const [gitStatus, setGitStatus] = useState<{ initialized: boolean; path: string } | null>(null)
  const [projectPath, setProjectPath] = useState<string>('')

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
        }
      } catch {
        // Fallback: use window location
        setProjectPath(window.location.origin.replace('http://localhost:', '').replace('http://', ''))
      }
    }
    
    await Promise.all([checkGit(), getProjectPath()])
  }

  useEffect(() => {
    fetchData()
    
    // Listen for global refresh event
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
    <div style={{
      background: '#252525',
      border: '1px solid #333',
      padding: '16px',
      borderRadius: '4px',
      marginBottom: '24px',
      fontSize: '12px'
    }}>
      <h3 style={{ marginBottom: '12px', color: '#5c9aff' }}>📍 Wo werden Dateien erstellt?</h3>
      <div style={{ color: '#e0e0e0', lineHeight: '1.6' }}>
        <p style={{ marginBottom: '8px' }}>
          <strong>Alle Dateien werden direkt in deinem Projektverzeichnis erstellt:</strong>
        </p>
        <div style={{ 
          background: '#1a1a1a', 
          padding: '12px', 
          borderRadius: '4px', 
          fontFamily: 'monospace',
          fontSize: '11px',
          marginBottom: '12px',
          color: '#5c9aff',
          wordBreak: 'break-all'
        }}>
          {projectPath || 'Lade Projektpfad...'}
        </div>
        <div style={{ 
          background: '#2a2a2a', 
          padding: '12px', 
          borderRadius: '4px', 
          marginBottom: '12px',
          fontSize: '11px',
          color: '#aaa'
        }}>
          <strong style={{ color: '#5c9aff' }}>📁 So findest du den Documents-Ordner:</strong>
          <ol style={{ marginLeft: '20px', marginTop: '8px', lineHeight: '1.8' }}>
            <li><strong>Finder öffnen</strong> (Cmd+Space, dann "Finder")</li>
            <li>In der <strong>Seitenleiste</strong> auf <strong>"Dokumente"</strong> klicken</li>
            <li>Oder: <strong>Cmd+Shift+O</strong> drücken → öffnet direkt "Dokumente"</li>
            <li>Dort findest du den Ordner <code style={{ color: '#5c9aff' }}>control-system</code></li>
          </ol>
          <p style={{ marginTop: '8px', color: '#7ec87e' }}>
            💡 <strong>Tipp:</strong> Du kannst den Pfad oben kopieren und im Finder einfügen (Cmd+Shift+G)
          </p>
        </div>
        <p style={{ marginBottom: '8px' }}>
          <strong>Beispiele:</strong>
        </p>
        <ul style={{ marginLeft: '20px', marginBottom: '12px', color: '#aaa' }}>
          <li><code style={{ color: '#5c9aff' }}>app/components/todo/TodoItem.tsx</code></li>
          <li><code style={{ color: '#5c9aff' }}>app/api/todos/route.ts</code></li>
          <li><code style={{ color: '#5c9aff' }}>lib/todo-store.ts</code></li>
          <li><code style={{ color: '#5c9aff' }}>types/todo.ts</code></li>
        </ul>
        
        <div style={{ 
          background: '#1a1a1a', 
          padding: '12px', 
          borderRadius: '4px', 
          marginTop: '12px',
          marginBottom: '12px'
        }}>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>🔧 Git Integration:</div>
          {gitStatus?.initialized ? (
            <div>
              <div style={{ color: '#7ec87e', marginBottom: '8px' }}>
                ✅ Git Repository initialisiert
                {gitStatus.path && (
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                    {gitStatus.path}
                  </div>
                )}
              </div>
              <GitRemoteManager />
            </div>
          ) : (
            <div>
              <div style={{ color: '#ffa500', marginBottom: '8px' }}>
                ⚠️ Git Repository nicht initialisiert
              </div>
              <button
                onClick={handleInitGit}
                style={{
                  padding: '6px 12px',
                  background: '#5c9aff',
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Git Repository initialisieren
              </button>
            </div>
          )}
        </div>

        <p style={{ color: '#7ec87e', marginTop: '12px' }}>
          ✅ <strong>Die Dateien sind sofort in deinem Editor/IDE sichtbar!</strong>
        </p>
        <p style={{ color: '#ffa500', marginTop: '8px' }}>
          💡 <strong>Tipp:</strong> Öffne das Projektverzeichnis in deinem Editor, um die Dateien live zu sehen.
        </p>
      </div>
    </div>
  )
}
