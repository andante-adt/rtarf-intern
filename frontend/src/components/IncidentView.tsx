import { useEffect, useState } from 'react'
import { getIncidents } from '../api'
import type { Incident } from '../types'

const SEV_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f59e0b',
  Medium:   '#3b82f6',
  Low:      '#22c55e',
}

interface Props {
  onSelectAlert: (id: string) => void
}

export default function IncidentView({ onSelectAlert }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getIncidents().then(data => {
      if (!active) return
      setIncidents(data)
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  if (loading) {
    return <div className="h-[160px] bg-[#0e1521] border border-[#1a2433] rounded-xl animate-pulse" />
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-8 text-center">
        <div className="font-mono text-[12px] text-[#4a6080]">
          ยังไม่พบ incident ที่เชื่อมโยงกัน (ต้องมี alert ≥ 2 ใบที่ source IP หรือ MITRE technique ตรงกัน)
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {incidents.map(inc => (
        <div
          key={inc.incident_id}
          className="bg-gradient-to-b from-[#0e1521] to-[#0d1521] border border-[#1a2433] rounded-xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <span
                className="font-mono text-[11px] px-2 py-0.5 rounded border"
                style={{ borderColor: SEV_COLOR[inc.max_severity], color: SEV_COLOR[inc.max_severity] }}
              >
                {inc.max_severity}
              </span>
              <span className="font-mono text-[12px] text-[#94a3b8]">
                {inc.alert_count} alerts linked
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#4a6080]">{inc.status}</span>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 font-mono text-[11px] text-[#5b7494]">
            {inc.shared_source_ips.length > 0 && <span>IP: {inc.shared_source_ips.join(', ')}</span>}
            {inc.shared_mitre_techniques.length > 0 && <span>Technique: {inc.shared_mitre_techniques.join(', ')}</span>}
          </div>

          <div className="space-y-1">
            {inc.alerts.map(a => (
              <button
                key={a.id}
                onClick={() => onSelectAlert(a.id)}
                className="w-full flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[#0f1623] transition-colors duration-150 text-left"
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SEV_COLOR[a.severity] }} />
                <span className="text-[12.5px] text-[#c9d8e8] truncate flex-1">{a.name}</span>
                <span className="font-mono text-[11px] text-[#4a6080] flex-shrink-0">{a.id}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}