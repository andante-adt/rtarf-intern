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

  // โหลด cached analysis เมื่อ switch alert
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
      if (action === 'block-ip')          await blockIp(alert.id, value)
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
  const ipBlocked    = auditLog.some(e => e.action === 'BLOCK_IP')
  const hostIsolated = auditLog.some(e => e.action === 'ISOLATE_HOST')

  return (
    <div>
      {/* Section label */}
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2.5 flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-[#4a6080]" />
        Incoming Alert
      </div>

      {/* Alert card */}
      <div
        className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-4 mb-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
        style={{ borderLeft: `3px solid ${borderColor}` }}
      >
        <div className="text-[18px] font-semibold text-[#e9eef5] mb-1.5 leading-snug">{alert.name}</div>
        <div className="font-mono text-[12.5px] text-[#5b7494] mb-3 flex items-center gap-1.5 flex-wrap">
          <span>{alert.observation_date}</span>
          <span className="text-[#2d3f52]">·</span>
          <span>{alert.issue_domain}</span>
          <span className="text-[#2d3f52]">·</span>
          <span>{alert.detection_method}</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3.5">
          <span className={`font-mono text-[11.5px] px-2.5 py-1 rounded-md border font-medium ${badgeCls}`}>
            {alert.severity}
          </span>
          <span className={`font-mono text-[11.5px] px-2.5 py-1 rounded-md border ${STATUS_CLS[status]}`}>
            {status}
          </span>
          <span className="font-mono text-[11.5px] px-2.5 py-1 rounded-md border text-slate-400 bg-slate-400/10 border-slate-400/20">
            {alert.category}
          </span>
        </div>
        <div className="text-[14px] text-[#9aabc0] leading-relaxed">{alert.description}</div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={handleAnalyze}
          disabled={loading || status === 'CLOSED'}
          className="font-mono text-[13px] tracking-wider bg-teal-700 hover:bg-teal-600 active:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg transition-all duration-150 shadow-[0_4px_14px_-4px_rgba(13,148,136,0.5)] hover:shadow-[0_6px_18px_-4px_rgba(13,148,136,0.65)] active:scale-[0.97] flex items-center gap-2"
        >
          {loading && (
            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.5" strokeOpacity="0.3"/>
              <path d="M21 12a9 9 0 0 0-9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          )}
          {loading ? 'ANALYZING…' : result ? 'RE-ANALYZE' : 'RUN ANALYSIS'}
        </button>

        {status === 'OPEN' && result && (
          <button
            onClick={() => handleAction('ACKNOWLEDGED')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-amber-500/40 text-amber-400 hover:bg-amber-400/10 hover:border-amber-500/60 disabled:opacity-40 px-5 py-2.5 rounded-lg transition-all duration-150"
          >
            {actLoading ? '…' : 'ACKNOWLEDGE'}
          </button>
        )}

        {status === 'ACKNOWLEDGED' && (
          <button
            onClick={() => handleAction('CLOSED')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-green-500/40 text-green-400 hover:bg-green-400/10 hover:border-green-500/60 disabled:opacity-40 px-5 py-2.5 rounded-lg transition-all duration-150"
          >
            {actLoading ? '…' : 'CLOSE ALERT'}
          </button>
        )}

        {status === 'CLOSED' && (
          <button
            onClick={() => handleAction('OPEN')}
            disabled={actLoading}
            className="font-mono text-[13px] tracking-wider border border-slate-500/40 text-slate-400 hover:bg-slate-400/10 hover:border-slate-500/60 disabled:opacity-40 px-5 py-2.5 rounded-lg transition-all duration-150"
          >
            {actLoading ? '…' : 'REOPEN'}
          </button>
        )}
      </div>

      {loading && !result && (
        <div className="mb-5 space-y-3">
          <div className="h-3 w-32 bg-[#15202e] rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-28 bg-[#0d1521] border border-[#1e2d3d] rounded-xl animate-pulse" />
            <div className="h-28 bg-[#0d1521] border border-[#1e2d3d] rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/[0.06] border border-[#2a1f24] border-l-[3px] border-l-red-500 rounded-xl px-5 py-3.5 mb-5 flex items-start gap-3">
          <svg className="flex-shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#f87171" strokeWidth="1.5"/>
            <path d="M12 8v5M12 16h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="text-[13px] text-red-400 font-medium mb-0.5">วิเคราะห์ไม่สำเร็จ</div>
            <div className="text-[12.5px] text-red-400/70 font-mono">{error}</div>
          </div>
        </div>
      )}

      {result && <AnalysisResults result={result} />}

      {/* ── Active Response ── */}
      {result && isTP && (alert.source_ip || alert.hostname) && (
        <>
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mt-6 mb-2.5 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-red-400" />
            Active Response
          </div>
          <div className="font-mono text-[11px] text-amber-400/80 bg-amber-400/[0.06] border border-amber-400/20 rounded-md px-3 py-1.5 mb-3.5 inline-block">
            ⚠ STUB MODE — บันทึก audit log แต่ยังไม่ส่งคำสั่งจริงไปยัง Palo Alto
          </div>
          <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-1 mb-3">

            {alert.source_ip && (
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10.5px] text-[#4a6080] uppercase tracking-widest w-20">Source IP</span>
                  <span className="font-mono text-[13.5px] text-[#c9d8e8]">{alert.source_ip}</span>
                </div>
                {ipBlocked ? (
                  <span className="font-mono text-[11px] tracking-wider text-green-400 bg-green-400/10 border border-green-400/30 px-4 py-2 rounded-lg flex items-center gap-1.5">
                    ✓ BLOCKED
                  </span>
                ) : confirmTarget?.action === 'block-ip' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber-400">ยืนยัน?</span>
                    <button
                      onClick={() => handleResponseAction('block-ip', alert.source_ip!)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 transition-all duration-150"
                    >
                      {respLoading === 'block-ip' ? '…' : 'ยืนยัน'}
                    </button>
                    <button
                      onClick={() => setConfirmTarget(null)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3.5 py-1.5 rounded-lg border border-[#2d3f52] text-[#5b7494] hover:bg-[#161f2c] disabled:opacity-40 transition-all duration-150"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTarget({ action: 'block-ip', value: alert.source_ip! })}
                    disabled={!!respLoading}
                    className="font-mono text-[12px] tracking-wider border border-red-500/40 text-red-400 hover:bg-red-400/10 hover:border-red-500/60 disabled:opacity-40 px-4 py-2 rounded-lg transition-all duration-150"
                  >
                    BLOCK IP
                  </button>
                )}
              </div>
            )}

            {alert.source_ip && alert.hostname && (
              <div className="border-t border-[#161f2c]" />
            )}

            {alert.hostname && (
              <div className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10.5px] text-[#4a6080] uppercase tracking-widest w-20">Hostname</span>
                  <span className="font-mono text-[13.5px] text-[#c9d8e8]">{alert.hostname}</span>
                </div>
                {hostIsolated ? (
                  <span className="font-mono text-[11px] tracking-wider text-green-400 bg-green-400/10 border border-green-400/30 px-4 py-2 rounded-lg flex items-center gap-1.5">
                    ✓ ISOLATED
                  </span>
                ) : confirmTarget?.action === 'isolate-host' ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-amber-400">ยืนยัน?</span>
                    <button
                      onClick={() => handleResponseAction('isolate-host', alert.hostname!)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3.5 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white disabled:opacity-40 transition-all duration-150"
                    >
                      {respLoading === 'isolate-host' ? '…' : 'ยืนยัน'}
                    </button>
                    <button
                      onClick={() => setConfirmTarget(null)}
                      disabled={!!respLoading}
                      className="font-mono text-[11px] px-3.5 py-1.5 rounded-lg border border-[#2d3f52] text-[#5b7494] hover:bg-[#161f2c] disabled:opacity-40 transition-all duration-150"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTarget({ action: 'isolate-host', value: alert.hostname! })}
                    disabled={!!respLoading}
                    className="font-mono text-[12px] tracking-wider border border-orange-500/40 text-orange-400 hover:bg-orange-400/10 hover:border-orange-500/60 disabled:opacity-40 px-4 py-2 rounded-lg transition-all duration-150"
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
          <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mt-6 mb-2.5 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-[#4a6080]" />
            Audit Log
          </div>
          <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-4">
            <div className="flex flex-col gap-0">
              {[...auditLog].reverse().map((entry, i) => (
                <AuditRow key={entry.id} entry={entry} isLast={i === auditLog.length - 1} />
              ))}
            </div>
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
      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mb-2.5 flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-teal-500" />
        Triage Result
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-4 hover:border-[#26405c] transition-colors">
          <div className="font-mono text-[11px] text-[#4a6080] tracking-widest uppercase mb-2.5">Verdict</div>
          <span className={`font-mono text-[12px] px-2.5 py-1 rounded-md border inline-block mb-2.5 font-medium ${
            isTP
              ? 'text-red-400 bg-red-400/10 border-red-400/30'
              : 'text-green-400 bg-green-400/10 border-green-400/30'
          }`}>
            {isTP ? 'TRUE POSITIVE' : 'FALSE POSITIVE'}
          </span>
          <div className="text-[14px] text-[#c9d8e8] leading-relaxed">{result.reason}</div>
        </div>

        <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-4 hover:border-[#26405c] transition-colors">
          <div className="font-mono text-[11px] text-[#4a6080] tracking-widest uppercase mb-2.5">MITRE ATT&amp;CK</div>
          <span className="font-mono text-[12px] px-2.5 py-1 rounded-md border inline-block mb-2.5 font-medium text-violet-400 bg-violet-400/10 border-violet-400/30">
            {tactic} / {technique}
          </span>
          <div className="text-[14px] text-[#c9d8e8] leading-relaxed">{result.summary}</div>
        </div>
      </div>

      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mt-6 mb-2.5 flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-violet-400" />
        Playbook — CPT Handbook
      </div>
      <div className="bg-[#0d1521] border border-[#1e2d3d] rounded-xl px-5 py-1 mb-3">
        {steps.map((step, i) => (
          <div key={i} className={`flex gap-4 items-start py-3 ${i > 0 ? 'border-t border-[#161f2c]' : ''}`}>
            <span className="font-mono text-[11px] text-[#4a6080] bg-[#161f2c] w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="text-[14px] text-[#c9d8e8] leading-relaxed pt-0.5">{step}</span>
          </div>
        ))}
      </div>

      <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mt-6 mb-2.5 flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-teal-400" />
        Recommended Action
      </div>
      <div className="bg-gradient-to-b from-teal-900/[0.12] to-teal-900/[0.04] border border-teal-700/25 rounded-xl px-5 py-4 text-[14px] text-teal-300 leading-loose">
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2.5">
            <span className="text-teal-500 flex-shrink-0">→</span>
            <span>{a}</span>
          </div>
        ))}
      </div>
    </>
  )
}
