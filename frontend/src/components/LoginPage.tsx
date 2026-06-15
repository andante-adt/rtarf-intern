import { useState } from 'react'
import { login } from '../api'

interface Props {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      onLogin()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#0a0e1a',
      }}
    >
      <div style={{ width: 360 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48, height: 48,
            borderRadius: 12,
            background: '#0f1f3d',
            border: '1px solid #1e3a5f',
            marginBottom: 16,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="#2563eb" opacity="0.3"/>
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="#60a5fa" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 20,
            fontWeight: 700,
            color: '#e2e8f0',
            letterSpacing: '0.15em',
          }}>
            RTARF-SOC
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#4a6080',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginTop: 4,
          }}>
            Alert Triage Platform
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#0f1623',
            border: '1px solid #1e2d3d',
            borderRadius: 12,
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#4a6080',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
              style={{
                background: '#0a0e1a',
                border: '1px solid #1e2d3d',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#c9d8e8',
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.target.style.borderColor = '#1e2d3d')}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: '#4a6080',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                background: '#0a0e1a',
                border: '1px solid #1e2d3d',
                borderRadius: 6,
                padding: '8px 12px',
                color: '#c9d8e8',
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none',
              }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.target.style.borderColor = '#1e2d3d')}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color: '#f87171',
              fontFamily: 'monospace',
              fontSize: 12,
              textAlign: 'center',
              padding: '8px 12px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 6,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: loading ? '#1e2d3d' : '#1e3a5f',
              border: '1px solid #2563eb',
              borderRadius: 6,
              padding: '10px 0',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: 13,
              letterSpacing: '0.1em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#2563eb' }}
            onMouseLeave={e => { if (!loading) (e.target as HTMLButtonElement).style.background = '#1e3a5f' }}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'SIGN IN'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 20,
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#2d3f52',
          letterSpacing: '0.1em',
        }}>
          RTARF AI-SOC · AUTHORIZED ACCESS ONLY
        </div>

      </div>
    </div>
  )
}