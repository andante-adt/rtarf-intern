import { useState, useEffect } from 'react'
import type { Alert, AnalysisResult, AlertStatus, AuditEntry } from '../types'
import { analyzeAlert, getAlertState, updateAlertStatus, getAuditLog, blockIp, isolateHost } from '../api'

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

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    })
  } catch {
    return ts
  }
}

interface Props {
  alert: Alert
  initialStatus: AlertStatus
  onStatusChange: (id: string, status: AlertStatus) => void
}

export default function AlertDetail({ alert, initialStatus, onStatusChange }: Props) {
  const [loading,       setLoading]       = useState(false)
  const [result,        setResult]        = useState<AnalysisResult | null>(null)
  const [error,         setError]         = useState<string | null>(null)
  const [status,        setStatus]        = useState<AlertStatus>(initialStatus)
  const [actLoading,    setActLoading]    = useState(false)
  const [auditLog,      setAuditLog]      = useState<AuditEntry[]>([])
  const [respLoading,   setRespLoading]   = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<{ action: string; value: string } | null>(null)

  const refreshAudit = () => getAuditLog(alert.id).then(setAuditLog)

  useEffect(() => {
    setStatus(initialStatus)
    setResult(null)
    setError(null)
    setAuditLog([])
    setConfirmTarget(null)
    getAlertState(alert.id).then(state => {
      if (state.analysis) setResult(state.analysis)
      if (state.status)   setStatus(state.status)
    })
    refreshAudit()
  }, [alert.id, initialStatus])

  const handleAnalyze = async () => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      setResult(await analyzeAlert(alert))
      await refreshAudit()
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
      await refreshAudit()
    } finally {
      setActLoading(false)
    }
  }

  const handleResponseAction = async (action: string, value: string) => {
    setRespLoading(action)
    setConfirmTarget(null)
    try {
      if (action === 'block-ip')       await blockIp(alert.id, value)
      else if (action === 'isolate-host') await isolateHost(alert.id, value)
      await refreshAudit()
    } catch (e) {
      console.error('[Response]', e)
    } finally {
      setRespLoading(null)
    }
  }

  const badgeCls    = SEV_BADGE_CLS[alert.severity] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/30'
  const borderColor = SEV_BORDER[alert.severity] ?? '#f59e0b'
  const isTP        = result?.verdict.toLowerCase().includes('true positive') ?? false

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

      {/* ── Active Response ── */}
      {result && isTP && (alert.source_ip || alert.hostname) && (
        <>
          <div className="border-t border-[#1e2d3d] my-4" />
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-3">
            Active Response
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-md px-4 py-2 mb-3 flex items-center gap-2">
            <span className="text-amber-400 font-mono text-[11px] tracking-wider">⚠ STUB MODE</span>
            <span className="text-amber-400/60 font-mono text-[11px]">— บันทึก audit log แต่ยังไม่ส่งคำสั่งจริงไปยัง Palo Alto</span>
          </div>
          <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-md overflow-hidden">

            {alert.source_ip && (
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#4a6080] uppercase tracking-wider w-20">Source IP</span>
                  <span className="font-mono text-[13px] text-[#e2e8f0]">{alert.source_ip}</span>
                </div>
                {confirmTarget?.action === 'block-ip' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber-400">ยืนยัน?</span>
                    <button
                      onClick={() => handleResponseAction('block-ip', alert.source_ip!)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
                    >
                      {respLoading === 'block-ip' ? '...' : 'ยืนยัน'}
                    </button>
                    <button
                      onClick={() => setConfirmTarget(null)}
                      className="font-mono text-[11px] px-3 py-1 rounded border border-[#1e2d3d] text-[#4a6080] hover:text-[#c9d8e8] transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTarget({ action: 'block-ip', value: alert.source_ip! })}
                    disabled={!!respLoading}
                    className="font-mono text-[11px] tracking-wider border border-red-500/40 text-red-400 hover:bg-red-400/10 disabled:opacity-40 px-4 py-1.5 rounded transition-colors"
                  >
                    BLOCK IP
                  </button>
                )}
              </div>
            )}

            {alert.source_ip && alert.hostname && (
              <div className="border-t border-[#111d2c]" />
            )}

            {alert.hostname && (
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-[#4a6080] uppercase tracking-wider w-20">Hostname</span>
                  <span className="font-mono text-[13px] text-[#e2e8f0]">{alert.hostname}</span>
                </div>
                {confirmTarget?.action === 'isolate-host' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber-400">ยืนยัน?</span>
                    <button
                      onClick={() => handleResponseAction('isolate-host', alert.hostname!)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 transition-colors"
                    >
                      {respLoading === 'isolate-host' ? '...' : 'ยืนยัน'}
                    </button>
                    <button
                      onClick={() => setConfirmTarget(null)}
                      className="font-mono text-[11px] px-3 py-1 rounded border border-[#1e2d3d] text-[#4a6080] hover:text-[#c9d8e8] transition-colors"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTarget({ action: 'isolate-host', value: alert.hostname! })}
                    disabled={!!respLoading}
                    className="font-mono text-[11px] tracking-wider border border-orange-500/40 text-orange-400 hover:bg-orange-400/10 disabled:opacity-40 px-4 py-1.5 rounded transition-colors"
                  >
                    ISOLATE HOST
                  </button>
                )}
              </div>
            )}

          </div>
        </>
      )}

      {/* Audit Log */}
      {auditLog.length > 0 && (
        <>
          <div className="border-t border-[#1e2d3d] my-4" />
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-3">
            Audit Log
          </div>
          <div className="flex flex-col gap-0">
            {[...auditLog].reverse().map((entry, i) => (
              <AuditRow key={entry.id} entry={entry} isLast={i === auditLog.length - 1} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function AuditRow({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const isStatus   = entry.action === 'STATUS_CHANGED'
  const isAnalyzed = entry.action === 'ANALYZED'
  const isBlockIP  = entry.action === 'BLOCK_IP'
  const isIsolate  = entry.action === 'ISOLATE_HOST'

  const dotColor = isAnalyzed ? '#3b82f6'
    : isBlockIP  ? '#ef4444'
    : isIsolate  ? '#f97316'
    : entry.detail?.includes('CLOSED')       ? '#22c55e'
    : entry.detail?.includes('ACKNOWLEDGED') ? '#f59e0b'
    : '#64748b'

  const actionLabel = isAnalyzed ? 'วิเคราะห์แล้ว'
    : isStatus  ? 'เปลี่ยนสถานะ'
    : isBlockIP ? 'Block IP'
    : isIsolate ? 'Isolate Host'
    : entry.action

  return (
    <div className="flex gap-3 text-[13px]">
      <div className="flex flex-col items-center" style={{ width: 16 }}>
        <div
          className="w-2 h-2 rounded-full shrink-0 mt-1"
          style={{ background: dotColor, boxShadow: `0 0 4px ${dotColor}` }}
        />
        {!isLast && <div className="w-px flex-1 bg-[#1e2d3d] mt-1" />}
      </div>
      <div className="pb-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-[#4a6080]">{actionLabel}</span>
          {entry.detail && (
            <span className="font-mono text-[11px] text-[#c9d8e8] bg-[#0d1521] border border-[#1e2d3d] px-2 py-0.5 rounded">
              {entry.detail}
            </span>
          )}
          <span className="font-mono text-[10px] text-[#2d3f52] ml-auto">
            {entry.actor}
          </span>
        </div>
        <div className="font-mono text-[10px] text-[#2d3f52] mt-0.5">
          {formatTimestamp(entry.timestamp)}
        </div>
      </div>
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