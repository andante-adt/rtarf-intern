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
        background: '#080b13',
        backgroundImage:
          'radial-gradient(circle at 50% 0%, rgba(13,148,136,0.12), transparent 60%), ' +
          'linear-gradient(#161f2c 1px, transparent 1px), linear-gradient(90deg, #161f2c 1px, transparent 1px)',
        backgroundSize: 'auto, 44px 44px, 44px 44px',
      }}
    >
      <div style={{ width: 380 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56, height: 56,
            borderRadius: 14,
            background: 'linear-gradient(180deg, #10243f, #0c1a2e)',
            border: '1px solid #22405f',
            boxShadow: '0 0 24px rgba(37,99,235,0.25)',
            marginBottom: 16,
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="#2563eb" opacity="0.35"/>
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                stroke="#3b82f6" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="#7dd3fc" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: 22,
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
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: '#14b8a6', display: 'inline-block' }} />
            Alert Triage Platform
          </div>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(13,19,32,0.9)',
            backdropFilter: 'blur(6px)',
            border: '1px solid #1e2d3d',
            borderRadius: 16,
            padding: '36px 32px',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6)',
          }}
        >
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'monospace',
              fontSize: 10.5,
              color: '#5b7494',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 500,
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
                background: '#080b13',
                border: '1px solid #1e2d3d',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#c9d8e8',
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'
              }}
              onBlur={e  => {
                e.target.style.borderColor = '#1e2d3d'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontFamily: 'monospace',
              fontSize: 10.5,
              color: '#5b7494',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 500,
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
                background: '#080b13',
                border: '1px solid #1e2d3d',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#c9d8e8',
                fontFamily: 'monospace',
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#3b82f6'
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)'
              }}
              onBlur={e  => {
                e.target.style.borderColor = '#1e2d3d'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              color: '#fca5a5',
              fontFamily: 'monospace',
              fontSize: 12,
              textAlign: 'center',
              padding: '10px 12px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" stroke="#fca5a5" strokeWidth="1.5"/>
                <path d="M12 8v5M12 16h.01" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
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
              borderRadius: 8,
              padding: '11px 0',
              color: '#e2e8f0',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '0.12em',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
            onMouseEnter={e => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.background = '#2563eb'
                ;(e.target as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(37,99,235,0.35)'
              }
            }}
            onMouseLeave={e => {
              if (!loading) {
                (e.target as HTMLButtonElement).style.background = '#1e3a5f'
                ;(e.target as HTMLButtonElement).style.boxShadow = 'none'
              }
            }}
          >
            {loading && (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#e2e8f0" strokeWidth="2.5" strokeOpacity="0.25"/>
                <path d="M21 12a9 9 0 0 0-9-9" stroke="#e2e8f0" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            )}
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'SIGN IN'}
          </button>
        </form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 24,
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#2d3f52',
          letterSpacing: '0.15em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: 999, background: '#2d3f52' }} />
          RTARF AI-SOC · AUTHORIZED ACCESS ONLY
          <span style={{ width: 4, height: 4, borderRadius: 999, background: '#2d3f52' }} />
        </div>

      </div>
    </div>
  )
}