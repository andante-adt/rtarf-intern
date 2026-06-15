import type { Alert, AnalysisResult, AlertStatus, AlertState } from './types'

// Vite proxies /api → http://127.0.0.1:8000 (see vite.config.ts)

export async function analyzeAlert(alert: Alert): Promise<AnalysisResult> {
  const resp = await fetch('/api/analyze-full', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(alert),
  })
  if (!resp.ok) throw new Error(`Server error: HTTP ${resp.status}`)
  const data = await resp.json()
  return data.analysis as AnalysisResult
}

export async function getAlertState(alertId: string): Promise<AlertState> {
  try {
    const resp = await fetch(`/api/alerts/${alertId}/analysis`)
    if (!resp.ok) return { status: 'OPEN', analysis: null }
    return resp.json()
  } catch {
    return { status: 'OPEN', analysis: null }
  }
}

export async function updateAlertStatus(alertId: string, status: AlertStatus): Promise<void> {
  await fetch(`/api/alerts/${alertId}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function getAllAlertStatuses(): Promise<Record<string, { status: AlertStatus }>> {
  try {
    const resp = await fetch('/api/alerts')
    if (!resp.ok) return {}
    return resp.json()
  } catch {
    return {}
  }
}