'use client'
import { useState } from 'react'
import { AlertTriangle, X, ShieldAlert, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Alert {
  id: string
  alert_type: string
  severity: string
  title: string
  message: string
  created_at: string
}

const SEVERITY_STYLE = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  warning:  'bg-orange-50 border-orange-200 text-orange-800',
  info:     'bg-blue-50 border-blue-200 text-blue-800',
}

const SEVERITY_ICON = {
  critical: <ShieldAlert size={15} className="text-red-600 shrink-0" />,
  warning:  <AlertTriangle size={15} className="text-orange-500 shrink-0" />,
  info:     <AlertTriangle size={15} className="text-blue-500 shrink-0" />,
}

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  // Toon alleen de meest kritieke alert + teller
  const sorted = [...visible].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 }
    return (order[a.severity as keyof typeof order] ?? 9) - (order[b.severity as keyof typeof order] ?? 9)
  })

  const top = sorted[0]
  const rest = sorted.length - 1

  async function handleResolve(alertId: string) {
    await fetch(`/api/admin/alerts/${alertId}/resolve`, { method: 'POST' })
    setDismissed(prev => new Set([...prev, alertId]))
  }

  return (
    <div className={`border rounded-lg px-4 py-2.5 flex items-start gap-3 ${SEVERITY_STYLE[top.severity as keyof typeof SEVERITY_STYLE] ?? SEVERITY_STYLE.info}`}>
      {SEVERITY_ICON[top.severity as keyof typeof SEVERITY_ICON] ?? SEVERITY_ICON.info}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{top.title}</span>
          {rest > 0 && (
            <span className="text-xs opacity-70">+{rest} andere alert{rest !== 1 ? 's' : ''}</span>
          )}
        </div>
        <p className="text-xs opacity-80 mt-0.5 leading-relaxed line-clamp-2">{top.message}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/auditlog"
          className="inline-flex items-center gap-1 text-xs font-medium opacity-80 hover:opacity-100 transition-opacity"
        >
          Bekijk <ChevronRight size={12} />
        </Link>
        <button
          onClick={() => handleResolve(top.id)}
          title="Markeer als afgehandeld"
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
