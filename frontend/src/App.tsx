import { useState, useEffect, useCallback } from 'react'
import { MOCK_ALERTS } from './mockAlerts'
import Sidebar from './components/Sidebar'
import AlertDetail from './components/AlertDetail'
import type { AlertStatus } from './types'
import { getAllAlertStatuses } from './api'

function getICTTime(): string {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Bangkok',
    hour12: false,
  }).replace('T', ' ') + ' ICT'
}

export default function App() {
  const [selectedId,  setSelectedId]  = useState<string>(MOCK_ALERTS[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [clock,       setClock]       = useState(getICTTime())
  const [statuses,    setStatuses]    = useState<Record<string, AlertStatus>>({})

  useEffect(() => {
    const t = setInterval(() => setClock(getICTTime()), 1000)
    return () => clearInterval(t)
  }, [])

  // โหลด status ของทุก alert จาก backend เมื่อเปิดหน้า
  useEffect(() => {
    getAllAlertStatuses().then(store => {
      const s: Record<string, AlertStatus> = {}
      for (const [id, entry] of Object.entries(store)) {
        s[id] = (entry.status ?? 'OPEN') as AlertStatus
      }
      setStatuses(s)
    })
  }, [])

  const handleStatusChange = useCallback((id: string, status: AlertStatus) => {
    setStatuses(prev => ({ ...prev, [id]: status }))
  }, [])

  const alert = MOCK_ALERTS.find(a => a.id === selectedId) ?? MOCK_ALERTS[0]

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-[#c9d8e8] font-sans overflow-hidden">

      {/* Sidebar */}
      <div
        className="flex-shrink-0 overflow-hidden transition-all duration-200"
        style={{ width: sidebarOpen ? 224 : 0 }}
      >
        <Sidebar
          alerts={MOCK_ALERTS}
          selectedId={selectedId}
          statuses={statuses}
          onSelect={setSelectedId}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#1e2d3d] flex-shrink-0 bg-[#0a0e1a]">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(s => !s)}
              className="text-[#4a6080] hover:text-[#c9d8e8] transition-colors p-1 rounded"
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
                <rect y="2"  width="18" height="2" rx="1"/>
                <rect y="8"  width="18" height="2" rx="1"/>
                <rect y="14" width="18" height="2" rx="1"/>
              </svg>
            </button>
            <div>
              <div className="font-mono text-[17px] font-semibold text-[#e2e8f0] tracking-wide">
                RTARF-SOC // Alert Triage Platform
              </div>
              <div className="font-mono text-[12px] text-[#4a6080] tracking-widest uppercase mt-0.5">
                Blue Team Unit · Cyber Protection
              </div>
            </div>
          </div>
          <div className="font-mono text-[13px] text-[#4a6080] flex items-center gap-2">
            <span
              className="inline-block w-[7px] h-[7px] rounded-full bg-green-500"
              style={{ boxShadow: '0 0 6px #22c55e' }}
            />
            SYSTEM ONLINE · {clock}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-7 py-5">
          <AlertDetail
            key={alert.id}
            alert={alert}
            initialStatus={statuses[alert.id] ?? 'OPEN'}
            onStatusChange={handleStatusChange}
          />
        </main>
      </div>
    </div>
  )
}