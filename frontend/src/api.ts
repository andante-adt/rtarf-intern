import type { Alert, AnalysisResult, AlertStatus, AlertState, AuditEntry } from './types'

// ── Token management ──────────────────────────────────────────────
const TOKEN_KEY = 'soc_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse<T>(resp: Response): Promise<T> {
  if (resp.status === 401) {
    clearToken()
    window.location.reload()
    throw new Error('Unauthorized')
  }
  if (!resp.ok) throw new Error(`Server error: HTTP ${resp.status}`)
  return resp.json()
}

// ── Auth ──────────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<void> {
  const resp = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!resp.ok) throw new Error('username หรือ password ไม่ถูกต้อง')
  const data = await resp.json()
  setToken(data.access_token)
}

// ── Alert API ─────────────────────────────────────────────────────
export async function analyzeAlert(alert: Alert): Promise<AnalysisResult> {
  const resp = await fetch('/api/analyze-full', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(alert),
  })
  const data = await handleResponse<{ analysis: AnalysisResult }>(resp)
  return data.analysis
}

export async function getAlertState(alertId: string): Promise<AlertState> {
  try {
    const resp = await fetch(`/api/alerts/${alertId}/analysis`, { headers: authHeaders() })
    return handleResponse<AlertState>(resp)
  } catch {
    return { status: 'OPEN', analysis: null }
  }
}

export async function updateAlertStatus(alertId: string, status: AlertStatus): Promise<void> {
  const resp = await fetch(`/api/alerts/${alertId}/status`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ status }),
  })
  await handleResponse<unknown>(resp)
}

export async function getAllAlertStatuses(): Promise<Record<string, { status: AlertStatus }>> {
  try {
    const resp = await fetch('/api/alerts', { headers: authHeaders() })
    return handleResponse<Record<string, { status: AlertStatus }>>(resp)
  } catch {
    return {}
  }
}

export async function getAuditLog(alertId: string): Promise<AuditEntry[]> {
  try {
    const resp = await fetch(`/api/alerts/${alertId}/audit`, { headers: authHeaders() })
    return handleResponse<AuditEntry[]>(resp)
  } catch {
    return []
  }
}