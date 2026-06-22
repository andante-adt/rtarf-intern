import { useEffect, useState } from 'react'
import { MOCK_ALERTS } from '../mockAlerts'
import { getAllAlertsFull, getAllAuditLog } from '../api'
import type { AlertState, AuditEntry } from '../types'

const SEV_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f59e0b',
  Medium:   '#3b82f6',
  Low:      '#22c55e',
}

const ACTION_LABEL: Record<string, string> = {
  ANALYZED:      'วิเคราะห์ alert',
  STATUS_CHANGED: 'เปลี่ยนสถานะ',
  BLOCK_IP:      'บล็อก IP',
  ISOLATE_HOST:  'แยกเครื่อง (Isolate)',
}

const ACTION_COLOR: Record<string, string> = {
  ANALYZED:       '#60a5fa',
  STATUS_CHANGED: '#94a3b8',
  BLOCK_IP:       '#f87171',
  ISOLATE_HOST:   '#fb923c',
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
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

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="font-mono text-[10.5px] text-[#5b7494] tracking-[0.18em] uppercase mb-2">{label}</div>
      <div className="font-mono text-[26px] font-semibold leading-none" style={{ color }}>{value}</div>
      {sub && <div className="font-mono text-[11px] text-[#4a6080] mt-1.5">{sub}</div>}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3.5">
      <span className="w-1 h-1 rounded-full bg-[#4a6080]" />
      <span className="font-mono text-[11px] text-[#5b7494] tracking-[0.18em] uppercase">{title}</span>
    </div>
  )
}

export default function Dashboard() {
  const [store, setStore] = useState<Record<string, AlertState>>({})
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([getAllAlertsFull(), getAllAuditLog()]).then(([s, a]) => {
      if (!active) return
      setStore(s)
      setAudit(a)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

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
  }))

  const analyzed = MOCK_ALERTS.filter(a => store[a.id]?.analysis).length
  const tp = MOCK_ALERTS.filter(a => store[a.id]?.analysis?.verdict === 'True Positive').length
  const fp = MOCK_ALERTS.filter(a => store[a.id]?.analysis?.verdict === 'False Positive').length
  const tpRate = analyzed > 0 ? Math.round((tp / analyzed) * 100) : 0

  const responseCount = audit.filter(e => e.action === 'BLOCK_IP' || e.action === 'ISOLATE_HOST').length

  // Mean time to respond: ANALYZED timestamp -> first BLOCK_IP/ISOLATE_HOST timestamp, per alert
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

  const recentActivity = [...audit].reverse().slice(0, 8)
  const alertName = (id: string) => MOCK_ALERTS.find(a => a.id === id)?.name ?? id

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-[88px] bg-[#0e1521] border border-[#1a2433] rounded-xl" />
          ))}
        </div>
        <div className="h-[220px] bg-[#0e1521] border border-[#1a2433] rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Alerts" value={total} color="#e2e8f0" sub={`${statusCounts.OPEN} เปิดอยู่`} />
        <StatCard label="Analyzed" value={`${analyzed}/${total}`} color="#60a5fa" sub="ผ่าน AI Triage" />
        <StatCard
          label="True / False Positive"
          value={analyzed > 0 ? `${tpRate}%` : '—'}
          color={tpRate >= 50 ? '#f87171' : '#22c55e'}
          sub={analyzed > 0 ? `TP ${tp} · FP ${fp}` : 'ยังไม่มีข้อมูล'}
        />
        <StatCard label="Mean Time to Respond" value={mttr} color="#fbbf24" sub={`${responseCount} response actions`} />
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Severity breakdown */}
        <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
          <SectionHeader title="Severity Breakdown" />
          <div className="space-y-2.5">
            {severityCounts.map(({ sev, count }) => (
              <div key={sev} className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-[#94a3b8] w-16 flex-shrink-0">{sev}</span>
                <div className="flex-1 h-2 bg-[#080b13] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: total > 0 ? `${(count / total) * 100}%` : '0%',
                      background: SEV_COLOR[sev],
                    }}
                  />
                </div>
                <span className="font-mono text-[12px] text-[#c9d8e8] w-5 text-right flex-shrink-0">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
          <SectionHeader title="Queue Status" />
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'OPEN',   value: statusCounts.OPEN,         color: '#e2e8f0' },
              { label: 'ACK',    value: statusCounts.ACKNOWLEDGED, color: '#f59e0b' },
              { label: 'CLOSED', value: statusCounts.CLOSED,       color: '#22c55e' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[#080b13] border border-[#1a2433] rounded-lg px-3 py-3 text-center">
                <div className="font-mono text-[22px] font-semibold" style={{ color }}>{value}</div>
                <div className="font-mono text-[10px] text-[#4a6080] tracking-widest uppercase mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
        <SectionHeader title="Recent Activity" />
        {recentActivity.length === 0 ? (
          <div className="font-mono text-[12px] text-[#4a6080] py-4 text-center">ยังไม่มีกิจกรรม</div>
        ) : (
          <div className="space-y-1">
            {recentActivity.map(e => (
              <div
                key={e.id}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-[#0f1623] transition-colors duration-150 border-b border-[#161f2c] last:border-b-0"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: ACTION_COLOR[e.action] ?? '#4a6080' }}
                />
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded border border-[#2d3f52] text-[#94a3b8] flex-shrink-0">
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <span className="text-[12.5px] text-[#c9d8e8] truncate flex-1">{alertName(e.alert_id)}</span>
                <span className="font-mono text-[11px] text-[#4a6080] flex-shrink-0">{e.actor}</span>
                <span className="font-mono text-[11px] text-[#4a6080] flex-shrink-0 w-[110px] text-right">{fmtTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
