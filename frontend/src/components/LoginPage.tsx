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
    <div className="flex h-screen bg-[#0a0e1a] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-mono text-2xl font-bold text-[#e2e8f0] tracking-widest">
            RTARF-SOC
          </div>
          <div className="font-mono text-xs text-[#4a6080] tracking-widest uppercase mt-1">
            Alert Triage Platform
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[#0f1623] border border-[#1e2d3d] rounded-lg p-8 flex flex-col gap-5"
        >
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-[#4a6080] uppercase tracking-widest">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="bg-[#0a0e1a] border border-[#1e2d3d] rounded px-3 py-2 text-[#c9d8e8] font-mono text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
              autoComplete="username"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-xs text-[#4a6080] uppercase tracking-widest">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-[#0a0e1a] border border-[#1e2d3d] rounded px-3 py-2 text-[#c9d8e8] font-mono text-sm focus:outline-none focus:border-[#3b82f6] transition-colors"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="text-red-400 font-mono text-xs text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 bg-[#1e3a5f] hover:bg-[#2563eb] border border-[#2563eb] text-[#e2e8f0] font-mono text-sm py-2 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'SIGN IN'}
          </button>
        </form>
      </div>
    </div>
  )
}