import type { Alert, AlertStatus } from '../types'

const SEV_COLOR: Record<string, string> = {
  Critical: '#ef4444',
  High:     '#f59e0b',
  Medium:   '#3b82f6',
  Low:      '#22c55e',
}

const STATUS_BADGE: Record<AlertStatus, { label: string; cls: string }> = {
  OPEN:         { label: 'OPEN',  cls: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
  ACKNOWLEDGED: { label: 'ACK',   cls: 'text-amber-400 bg-amber-400/10 border-amber-400/30' },
  CLOSED:       { label: 'CLOSE', cls: 'text-green-400 bg-green-400/10 border-green-400/30' },
}

interface Props {
  alerts: Alert[]
  selectedId: string
  statuses: Record<string, AlertStatus>
  onSelect: (id: string) => void
}

export default function Sidebar({ alerts, selectedId, statuses, onSelect }: Props) {
  const getStatus = (id: string): AlertStatus => statuses[id] ?? 'OPEN'

  const counts = {
    open:     alerts.filter(a => getStatus(a.id) === 'OPEN').length,
    acked:    alerts.filter(a => getStatus(a.id) === 'ACKNOWLEDGED').length,
    closed:   alerts.filter(a => getStatus(a.id) === 'CLOSED').length,
    Critical: alerts.filter(a => a.severity === 'Critical' && getStatus(a.id) !== 'CLOSED').length,
    High:     alerts.filter(a => a.severity === 'High'     && getStatus(a.id) !== 'CLOSED').length,
    Medium:   alerts.filter(a => a.severity === 'Medium'   && getStatus(a.id) !== 'CLOSED').length,
  }

  return (
    <div className="w-56 h-full bg-[#0b0f19] border-r border-[#1e2d3d] flex flex-col overflow-y-auto">

      {/* Alert Queue */}
      <div className="p-3">
        <div className="font-mono text-[11px] text-[#4a6080] tracking-widest uppercase mb-2.5">
          Alert Queue
        </div>

        <div className="space-y-1">
          {alerts.map(a => {
            const active  = a.id === selectedId
            const status  = getStatus(a.id)
            const closed  = status === 'CLOSED'
            const dot     = SEV_COLOR[a.severity] ?? '#94a3b8'
            const time    = a.observation_date.slice(11, 16)
            const badge   = STATUS_BADGE[status]

            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                className={[
                  'w-full text-left flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg border transition-all duration-150',
                  active
                    ? 'bg-[#111d2c] border-[#26405c] shadow-[0_0_0_1px_rgba(37,99,235,0.15),0_4px_12px_-4px_rgba(0,0,0,0.4)]'
                    : 'border-transparent hover:bg-[#0f1623] hover:border-[#1e2d3d]',
                  closed ? 'opacity-40' : '',
                ].join(' ')}
              >
                <span className="relative flex-shrink-0 mt-[5px]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: closed ? '#4a6080' : dot }}
                  />
                  {active && !closed && (
                    <span
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: dot, opacity: 0.5 }}
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-[13px] font-medium leading-snug ${closed ? 'line-through text-[#4a6080]' : 'text-[#c9d8e8]'}`}>
                    {a.name}
                  </div>
                  <div className="font-mono text-[11px] text-[#4a6080] mt-1 flex items-center gap-1.5">
                    <span style={{ color: closed ? undefined : dot }}>{a.severity.toUpperCase()}</span>
                    <span className="text-[#2d3f52]">·</span>
                    <span>{time}</span>
                    {status !== 'OPEN' && (
                      <span className={`font-mono text-[10px] px-1.5 py-px rounded border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1e2d3d]" />

      {/* Queue Status */}
      <div className="p-3">
        <div className="font-mono text-[11px] text-[#4a6080] tracking-widest uppercase mb-2.5">
          Queue Status
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'OPEN',     value: counts.open,     color: '#e2e8f0' },
            { label: 'ACK',      value: counts.acked,    color: '#f59e0b' },
            { label: 'CLOSED',   value: counts.closed,   color: '#22c55e' },
            { label: 'CRITICAL', value: counts.Critical, color: '#ef4444' },
            { label: 'HIGH',     value: counts.High,     color: '#f59e0b' },
            { label: 'MEDIUM',   value: counts.Medium,   color: '#60a5fa' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-[#080b13] border border-[#1a2433] rounded-md px-2 py-1.5 flex items-center justify-between">
              <span className="font-mono text-[9.5px] text-[#4a6080] tracking-wide">{label}</span>
              <span className="font-mono text-[13px] font-semibold" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
