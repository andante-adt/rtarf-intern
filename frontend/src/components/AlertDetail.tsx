import { useState, useEffect } from 'react'
import type { Alert, AnalysisResult, AlertStatus } from '../types'
import { analyzeAlert, getAlertState, updateAlertStatus } from '../api'

const SEV_BORDER: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f59e0b',
  Medium:   '#3b82f6',
  Low:      '#22c55e',
}
const SEV_BADGE_CLS: Record<string, string> = {
  Critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  High:     'text-amber-400 bg-amber-400/10 border-amber-400/30',
  Medium:   'text-blue-400 bg-blue-400/10 border-blue-400/30',
  Low:      'text-green-400 bg-green-400/10 border-green-400/30',
}
const STATUS_CLS: Record<AlertStatus, string> = {
  OPEN:         'text-slate-400 bg-slate-400/10 border-slate-400/20',
  ACKNOWLEDGED: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
  CLOSED:       'text-green-400 bg-green-400/10 border-green-400/30',
}

function sanitizeMitre(val?: string | null): string {
  if (!val) return '-'
  const v = val.trim()
  if (['-', '', '[]', 'null', 'None', 'none'].includes(v)) return '-'
  if (v.startsWith('[') && v.endsWith(']')) {
    try {
      const parsed = JSON.parse(v.replace(/'/g, '"'))
      if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean).join(', ')
    } catch { /* ignore */ }
  }
  return v
}

interface Props {
  alert: Alert
  initialStatus: AlertStatus
  onStatusChange: (id: string, status: AlertStatus) => void
}

export default function AlertDetail({ alert, initialStatus, onStatusChange }: Props) {
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<AnalysisResult | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [status,   setStatus]   = useState<AlertStatus>(initialStatus)
  const [actLoading, setActLoading] = useState(false)

  // โหลด cached analysis เมื่อ switch alert
  useEffect(() => {
    setStatus(initialStatus)
    setResult(null)
    setError(null)
    getAlertState(alert.id).then(state => {
      if (state.analysis) setResult(state.analysis)
      if (state.status)   setStatus(state.status)
    })
  }, [alert.id, initialStatus])

  const handleAnalyze = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      setResult(await analyzeAlert(alert))
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (newStatus: AlertStatus) => {
    setActLoading(true)
    try {
      await updateAlertStatus(alert.id, newStatus)
      setStatus(newStatus)
      onStatusChange(alert.id, newStatus)
    } finally {
      setActLoading(false)
    }
  }

  const badgeCls    = SEV_BADGE_CLS[alert.severity] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/30'
  const borderColor = SEV_BORDER[alert.severity] ?? '#f59e0b'

  return (
    <div>
      {/* Section label */}
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">
        Incoming Alert
      </div>

      {/* Alert card */}
      <div
        className="bg-[#0d1521] border border-[#1e2d3d] rounded-md px-5 py-4 mb-4 border-l-4"
        style={{ borderLeftColor: borderColor }}
      >
        <div className="text-[17px] font-semibold text-[#e2e8f0] mb-1">{alert.name}</div>
        <div className="font-mono text-[13px] text-[#4a6080] mb-2">
          {alert.observation_date} &nbsp;·&nbsp; {alert.issue_domain} &nbsp;·&nbsp; {alert.detection_method}
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`font-mono text-[12px] px-2 py-0.5 rounded border ${badgeCls}`}>
            {alert.severity}
          </span>
          <span className={`font-mono text-[12px] px-2 py-0.5 rounded border ${STATUS_CLS[status]}`}>
            {status}
          </span>
          <span className="font-mono text-[12px] px-2 py-0.5 rounded border text-slate-400 bg-slate-400/10 border-slate-400/20">
            {alert.category}
          </span>
        </div>
        <div className="text-[14px] text-[#8898aa] leading-relaxed">{alert.description}</div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleAnalyze}
          disabled={loading || status === 'CLOSED'}
          className="font-mono text-[13px] tracking-wider bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded transition-colors"
        >
          {loading ? 'ANALYZING…' : result ? 'RE-ANALYZE' : 'RUN ANALYSIS'}
        </button>

        {status === 'OPEN' && result && (
          <button
            onClick={() => handleAction('ACKNOWLEDGED')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-amber-500/50 text-amber-400 hover:bg-amber-400/10 disabled:opacity-40 px-5 py-2.5 rounded transition-colors"
          >
            {actLoading ? '…' : 'ACKNOWLEDGE'}
          </button>
        )}

        {status === 'ACKNOWLEDGED' && (
          <button
            onClick={() => handleAction('CLOSED')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-green-500/50 text-green-400 hover:bg-green-400/10 disabled:opacity-40 px-5 py-2.5 rounded transition-colors"
          >
            {actLoading ? '…' : 'CLOSE ALERT'}
          </button>
        )}

        {status === 'CLOSED' && (
          <button
            onClick={() => handleAction('OPEN')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-slate-500/50 text-slate-400 hover:bg-slate-400/10 disabled:opacity-40 px-5 py-2.5 rounded transition-colors"
          >
            {actLoading ? '…' : 'REOPEN'}
          </button>
        )}
      </div>

      <div className="border-t border-[#1e2d3d] my-4" />

      {error && (
        <div className="bg-red-500/5 border border-[#1e2d3d] border-l-4 border-l-red-500 rounded-md px-5 py-3 text-[14px] text-red-400 mb-4">
          ERROR: {error}
        </div>
      )}

      {result && <AnalysisResults result={result} />}
    </div>
  )
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const isTP      = result.verdict.toLowerCase().includes('true positive')
  const tactic    = sanitizeMitre(result.mitre_tactic)
  const technique = sanitizeMitre(result.mitre_technique)
  const steps     = Array.isArray(result.playbook_steps)
    ? result.playbook_steps
    : [String(result.playbook_steps)]
  const actions   = Array.isArray(result.recommended_action)
    ? result.recommended_action
    : [String(result.recommended_action)]

  return (
    <>
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">
        Triage Result
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-md px-5 py-4">
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">Verdict</div>
          <span className={`font-mono text-[12px] px-2 py-0.5 rounded border inline-block mb-2 ${
            isTP
              ? 'text-red-400 bg-red-400/10 border-red-400/30'
              : 'text-green-400 bg-green-400/10 border-green-400/30'
          }`}>
            {isTP ? 'TRUE POSITIVE' : 'FALSE POSITIVE'}
          </span>
          <div className="text-[14px] text-[#c9d8e8] leading-relaxed">{result.reason}</div>
        </div>

        <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-md px-5 py-4">
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">MITRE ATT&amp;CK</div>
          <span className="font-mono text-[12px] px-2 py-0.5 rounded border inline-block mb-2 text-violet-400 bg-violet-400/10 border-violet-400/30">
            {tactic} / {technique}
          </span>
          <div className="text-[14px] text-[#c9d8e8] leading-relaxed">{result.summary}</div>
        </div>
      </div>

      <div className="border-t border-[#1e2d3d] my-4" />
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">
        Playbook — CPT Handbook
      </div>
      <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-md px-5 py-1 mb-3">
        {steps.map((step, i) => (
          <div key={i} className={`flex gap-4 items-start py-2.5 ${i > 0 ? 'border-t border-[#111d2c]' : ''}`}>
            <span className="font-mono text-[12px] text-[#4a6080] w-6 shrink-0 pt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[14px] text-[#c9d8e8] leading-relaxed">{step}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-[#1e2d3d] my-4" />
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2">
        Recommended Action
      </div>
      <div className="bg-teal-900/10 border border-teal-700/30 border-l-4 border-l-teal-600 rounded-md px-5 py-4 text-[14px] text-teal-300 leading-loose">
        {actions.map((a, i) => (
          <div key={i}>→ {a}</div>
        ))}
      </div>
    </>
  )
}