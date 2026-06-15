export interface Alert {
  id: string
  name: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  observation_date: string
  issue_domain: string
  detection_method: string
  category: string
  description: string
}

export interface AnalysisResult {
  verdict: string
  mitre_tactic: string
  mitre_technique: string
  summary: string
  reason: string
  playbook_steps: string[] | string
  recommended_action: string | string[]
}

// export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED'

export interface AlertState {
  status: AlertStatus
  analysis: AnalysisResult | null
  analyzed_at?: string | null
}

export interface Alert {
  id: string
  name: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  observation_date: string
  issue_domain: string
  detection_method: string
  category: string
  description: string
}

export interface AnalysisResult {
  verdict: string
  mitre_tactic: string
  mitre_technique: string
  summary: string
  reason: string
  playbook_steps: string[] | string
  recommended_action: string | string[]
}

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED'

export interface AlertState {
  status: AlertStatus
  analysis: AnalysisResult | null
  analyzed_at?: string | null
}

export interface AuditEntry {
  id: number
  alert_id: string
  action: string
  actor: string
  detail: string
  timestamp: string
}