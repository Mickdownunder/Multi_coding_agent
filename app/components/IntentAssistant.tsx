'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface IntentPreview {
  goal: string
  requirements: string[]
  constraints?: string[]
  costEstimate?: number
}

export default function IntentAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [intentPreview, setIntentPreview] = useState<IntentPreview | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response || 'No response',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // Show intent preview if available
      if (data.suggestedIntent) {
        setIntentPreview({
          goal: data.suggestedIntent.goal || '',
          requirements: data.suggestedIntent.requirements || [],
          constraints: data.suggestedIntent.constraints || [],
          costEstimate: data.costEstimate
        })
        setShowPreview(true)
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateIntent = async () => {
    if (!intentPreview) return

    setLoading(true)
    try {
      const response = await fetch('/api/assistant/generate-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: intentPreview })
      })

      if (!response.ok) {
        throw new Error('Failed to generate intent')
      }

      setShowPreview(false)
      setIntentPreview(null)
      
      // Trigger dashboard refresh to update intent.md display
      window.dispatchEvent(new CustomEvent('dashboard-refresh'))
      
      const successMessage: Message = {
        role: 'assistant',
        content: '✅ Intent wurde in intent.md gespeichert!\n\n📋 Nächster Schritt: Gehe zum "Dashboard" Tab um das Intent zu sehen, oder zum "Monitor" Tab und klicke auf "Start Execution" um den Plan zu generieren und Code zu erstellen.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="intent-assistant">
      <h2>Intent Assistant</h2>
      
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message message-${msg.role}`}>
            <div className="message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <div className="message-role">Assistant</div>
            <div className="message-content">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {showPreview && intentPreview && (
        <div className="intent-preview">
          <h3>Intent Preview</h3>
          <div className="preview-content">
            <div><strong>Goal:</strong> {intentPreview.goal}</div>
            <div><strong>Requirements:</strong></div>
            <ul>
              {intentPreview.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
            {intentPreview.constraints && intentPreview.constraints.length > 0 && (
              <>
                <div><strong>Constraints:</strong></div>
                <ul>
                  {intentPreview.constraints.map((constraint, i) => (
                    <li key={i}>{constraint}</li>
                  ))}
                </ul>
              </>
            )}
            {intentPreview.costEstimate && (
              <div><strong>Estimated Cost:</strong> ${intentPreview.costEstimate.toFixed(2)}</div>
            )}
          </div>
          <div className="preview-actions">
            <button onClick={handleGenerateIntent} disabled={loading}>
              Generate Intent
            </button>
            <button onClick={() => setShowPreview(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type your message..."
          disabled={loading}
          rows={3}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
