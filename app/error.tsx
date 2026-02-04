'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div className="dashboard">
      <div className="error" style={{ padding: '24px', margin: '20px 0' }}>
        <h2 style={{ marginBottom: '12px', color: '#ff6b6b' }}>Something went wrong</h2>
        <p style={{ marginBottom: '16px', fontSize: '13px' }}>
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          className="state-btn"
          onClick={reset}
          style={{ marginRight: '8px' }}
        >
          Try again
        </button>
      </div>
    </div>
  )
}
