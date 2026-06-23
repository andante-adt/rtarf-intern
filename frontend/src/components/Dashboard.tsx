import { useEffect, useState, useCallback } from 'react'
import { MOCK_ALERTS } from '../mockAlerts'
import { getAllAlertsFull, getAllAuditLog } from '../api'
import type { AlertState, AuditEntry } from '../types'

const SEV_COLOR: Record<string, string> = {
  Critical: '#d4af6a',
  High:     '#f59e0b',
  Medium:   '#3b82f6',
  Low:      '#22c55e',
}

const ACTION_LABEL: Record<string, string> = {
  ANALYZED:       'วิเคราะห์ alert',
  STATUS_CHANGED: 'เปลี่ยนสถานะ',
  BLOCK_IP:       'บล็อก IP',
  ISOLATE_HOST:   'แยกเครื่อง (Isolate)',
}

const ACTION_COLOR: Record<string, string> = {
  ANALYZED:       '#60a5fa',
  STATUS_CHANGED: '#94a3b8',
  BLOCK_IP:       '#f87171',
  ISOLATE_HOST:   '#fb923c',
}

const ACTION_FILTERS = ['ทั้งหมด', 'ANALYZED', 'STATUS_CHANGED', 'BLOCK_IP', 'ISOLATE_HOST']

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} วิ`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return `${m} น. ${rem} วิ`
  const h = Math.floor(m / 60)
  return `${h} ชม. ${m % 60} น.`
}

function StatCard({
  label, value, color, sub, icon,
}: {
  label: string; value: string | number; color: string; sub?: string; icon: React.ReactNode
}) {
  return (
    <div
      className="relative bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Glow blob */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-10 pointer-events-none"
        style={{ background: color }}
      />
      <div className="flex items-start justify-between mb-2">
        <div className="font-mono text-[10.5px] text-[#5b7494] tracking-[0.18em] uppercase">{label}</div>
        <div className="text-[#2d3f52]">{icon}</div>
      </div>
      <div className="font-mono text-[28px] font-semibold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-[#4a6080] mt-2">{sub}</div>}
    </div>
  )
}

function SectionHeader({ title, extra }: { title: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3.5">
      <div className="flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-teal-500" />
        <span className="font-mono text-[11px] text-[#5b7494] tracking-[0.18em] uppercase">{title}</span>
      </div>
      {extra}
    </div>
  )
}

function exportCSV(audit: AuditEntry[], alertName: (id: string) => string) {
  const rows = [
    ['timestamp', 'action', 'alert', 'actor', 'detail'],
    ...audit.map(e => [
      e.timestamp, e.action, alertName(e.alert_id), e.actor, e.detail ?? '',
    ]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rtarf-soc-activity-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Dashboard() {
  const [store, setStore]     = useState<Record<string, AlertState>>({})
  const [audit, setAudit]     = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [countdown, setCountdown]     = useState(30)
  const [actionFilter, setActionFilter] = useState('ทั้งหมด')

  const fetchData = useCallback(() => {
    Promise.all([getAllAlertsFull(), getAllAuditLog()]).then(([s, a]) => {
      setStore(s)
      setAudit(a)
      setLoading(false)
      setLastRefresh(new Date())
      setCountdown(30)
    })
  }, [])

  // Initial fetch
  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh ทุก 30 วิ
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return 30 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [fetchData])

  const getStatus = (id: string) => store[id]?.status ?? 'OPEN'

  const total = MOCK_ALERTS.length
  const statusCounts = {
    OPEN:         MOCK_ALERTS.filter(a => getStatus(a.id) === 'OPEN').length,
    ACKNOWLEDGED: MOCK_ALERTS.filter(a => getStatus(a.id) === 'ACKNOWLEDGED').length,
    CLOSED:       MOCK_ALERTS.filter(a => getStatus(a.id) === 'CLOSED').length,
  }

  const severityCounts = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    sev,
    count: MOCK_ALERTS.filter(a => a.severity === sev).length,
    pct: total > 0 ? Math.round((MOCK_ALERTS.filter(a => a.severity === sev).length / total) * 100) : 0,
  }))

  const analyzed    = MOCK_ALERTS.filter(a => store[a.id]?.analysis).length
  const tp          = MOCK_ALERTS.filter(a => store[a.id]?.analysis?.verdict === 'True Positive').length
  const fp          = MOCK_ALERTS.filter(a => store[a.id]?.analysis?.verdict === 'False Positive').length
  const tpRate      = analyzed > 0 ? Math.round((tp / analyzed) * 100) : 0
  const responseCount = audit.filter(e => e.action === 'BLOCK_IP' || e.action === 'ISOLATE_HOST').length

  const responseDeltas: number[] = []
  for (const a of MOCK_ALERTS) {
    const entries = audit.filter(e => e.alert_id === a.id).sort((x, y) => x.timestamp.localeCompare(y.timestamp))
    const analyzedEntry = entries.find(e => e.action === 'ANALYZED')
    const responseEntry = entries.find(e => e.action === 'BLOCK_IP' || e.action === 'ISOLATE_HOST')
    if (analyzedEntry && responseEntry) {
      const delta = new Date(responseEntry.timestamp).getTime() - new Date(analyzedEntry.timestamp).getTime()
      if (delta >= 0) responseDeltas.push(delta)
    }
  }
  const mttr = responseDeltas.length > 0
    ? fmtDuration(responseDeltas.reduce((a, b) => a + b, 0) / responseDeltas.length)
    : 'ยังไม่มีข้อมูล'

  const alertName = (id: string) => MOCK_ALERTS.find(a => a.id === id)?.name ?? id

  const filteredAudit = [...audit]
    .reverse()
    .filter(e => actionFilter === 'ทั้งหมด' || e.action === actionFilter)
    .slice(0, 8)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[100px] bg-[#0e1521] border border-[#1a2433] rounded-xl" />
          ))}
        </div>
        <div className="h-[220px] bg-[#0e1521] border border-[#1a2433] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] text-[#4a6080] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
          อัปเดตล่าสุด {fmtTime(lastRefresh.toISOString())}
          <span className="text-[#2d3f52]">· refresh ใน {countdown} วิ</span>
        </div>
        <button
          onClick={fetchData}
          className="font-mono text-[11px] text-[#5b7494] hover:text-teal-400 border border-[#1a2433] hover:border-teal-500/40 px-3 py-1.5 rounded-lg transition-all duration-150 flex items-center gap-1.5"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 0 0-9-9 9 9 0 0 0-6.36 2.64L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          REFRESH NOW
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Alerts" value={total} color="#e2e8f0"
          sub={`${statusCounts.OPEN} เปิดอยู่`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
        <StatCard
          label="Analyzed" value={`${analyzed}/${total}`} color="#60a5fa"
          sub="ผ่าน AI Triage"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          }
        />
        <StatCard
          label="True / False Positive"
          value={analyzed > 0 ? `${tpRate}%` : '—'}
          color={tpRate >= 50 ? '#f87171' : '#22c55e'}
          sub={analyzed > 0 ? `TP ${tp} · FP ${fp}` : 'ยังไม่มีข้อมูล'}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <path d="m9 11 3 3L22 4"/>
            </svg>
          }
        />
        <StatCard
          label="Mean Time to Respond" value={mttr} color="#fbbf24"
          sub={`${responseCount} response actions`}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Severity breakdown */}
        <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
          <SectionHeader title="Severity Breakdown" />
          <div className="space-y-3">
            {severityCounts.map(({ sev, count, pct }) => (
              <div key={sev}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] text-[#94a3b8]">{sev}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px]" style={{ color: SEV_COLOR[sev] }}>{pct}%</span>
                    <span className="font-mono text-[12px] text-[#c9d8e8] w-4 text-right">{count}</span>
                  </div>
                </div>
                <div className="h-2 bg-[#080b13] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: SEV_COLOR[sev],
                      boxShadow: count > 0 ? `0 0 8px ${SEV_COLOR[sev]}88` : 'none',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
          <SectionHeader title="Queue Status" />
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'OPEN',   value: statusCounts.OPEN,         color: '#e2e8f0', bg: 'rgba(226,232,240,0.05)' },
              { label: 'ACK',    value: statusCounts.ACKNOWLEDGED, color: '#f59e0b', bg: 'rgba(245,158,11,0.05)'  },
              { label: 'CLOSED', value: statusCounts.CLOSED,       color: '#22c55e', bg: 'rgba(34,197,94,0.05)'   },
            ].map(({ label, value, color, bg }) => (
              <div
                key={label}
                className="border rounded-xl px-3 py-4 text-center transition-all duration-150"
                style={{ borderColor: `${color}33`, background: bg }}
              >
                <div
                  className="font-mono text-[32px] font-bold leading-none mb-1"
                  style={{ color, textShadow: `0 0 20px ${color}66` }}
                >
                  {value}
                </div>
                <div className="font-mono text-[10px] tracking-widest uppercase mt-2" style={{ color: `${color}99` }}>
                  {label}
                </div>
                <div className="mt-2 h-0.5 rounded-full mx-auto w-8" style={{ background: `${color}44` }} />
              </div>
            ))}
          </div>

          {/* Progress bar สัดส่วน */}
          <div className="mt-4">
            <div className="h-1.5 bg-[#080b13] rounded-full overflow-hidden flex">
              {total > 0 && [
                { v: statusCounts.OPEN,         c: '#e2e8f0' },
                { v: statusCounts.ACKNOWLEDGED, c: '#f59e0b' },
                { v: statusCounts.CLOSED,       c: '#22c55e' },
              ].map(({ v, c }, i) => (
                <div key={i} style={{ width: `${(v / total) * 100}%`, background: c }} />
              ))}
            </div>
            <div className="font-mono text-[10px] text-[#4a6080] mt-1.5 text-right">
              {Math.round((statusCounts.CLOSED / total) * 100)}% resolved
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
        <SectionHeader
          title="Recent Activity"
          extra={
            <div className="flex items-center gap-2">
              {/* Filter buttons */}
              <div className="flex items-center gap-1">
                {ACTION_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setActionFilter(f)}
                    className="font-mono text-[10px] px-2 py-1 rounded-md border transition-all duration-150"
                    style={{
                      borderColor: actionFilter === f ? (ACTION_COLOR[f] ?? '#14b8a6') : '#1a2433',
                      color:       actionFilter === f ? (ACTION_COLOR[f] ?? '#14b8a6') : '#4a6080',
                      background:  actionFilter === f ? `${ACTION_COLOR[f] ?? '#14b8a6'}15` : 'transparent',
                    }}
                  >
                    {f === 'ทั้งหมด' ? 'ALL' : ACTION_LABEL[f]?.split(' ')[0] ?? f}
                  </button>
                ))}
              </div>
              {/* Export CSV */}
              <button
                onClick={() => exportCSV(audit, alertName)}
                className="font-mono text-[10px] text-[#4a6080] hover:text-teal-400 border border-[#1a2433] hover:border-teal-500/40 px-2 py-1 rounded-md transition-all duration-150 flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                CSV
              </button>
            </div>
          }
        />

        {filteredAudit.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(74,96,128,0.1)', border: '1px solid #1a2433' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a6080" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div className="font-mono text-[12px] text-[#4a6080]">ยังไม่มีกิจกรรม</div>
            <div className="font-mono text-[10px] text-[#2d3f52]">กิจกรรมจะแสดงที่นี่เมื่อมีการวิเคราะห์ alert</div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredAudit.map(e => (
              <div
                key={e.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#0f1623] transition-colors duration-150 border-b border-[#161f2c] last:border-b-0 group"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: ACTION_COLOR[e.action] ?? '#4a6080', boxShadow: `0 0 4px ${ACTION_COLOR[e.action] ?? '#4a6080'}88` }}
                />
                <span
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0"
                  style={{
                    borderColor: `${ACTION_COLOR[e.action] ?? '#4a6080'}40`,
                    color: ACTION_COLOR[e.action] ?? '#94a3b8',
                    background: `${ACTION_COLOR[e.action] ?? '#4a6080'}10`,
                  }}
                >
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="text-[12.5px] text-[#c9d8e8] truncate flex-1 group-hover:text-white transition-colors">
                  {alertName(e.alert_id)}
                </span>
                <span className="font-mono text-[11px] text-[#4a6080]">{e.actor}</span>
                <span className="font-mono text-[11px] text-[#4a6080] flex-shrink-0 w-[110px] text-right">{fmtTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}