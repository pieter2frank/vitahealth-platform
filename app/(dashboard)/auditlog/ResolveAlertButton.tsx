'use client'
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function ResolveAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  async function handle() {
    setLoading(true)
    await fetch(`/api/admin/alerts/${alertId}/resolve`, { method: 'POST' })
    setLoading(false)
    setDone(true)
    router.refresh()
  }

  if (done) return <Check size={14} className="text-emerald-500 shrink-0 mt-1" />

  return (
    <button
      onClick={handle}
      disabled={loading}
      title="Markeer als afgehandeld"
      className="shrink-0 mt-0.5 text-xs font-medium text-[#64748b] border border-[#e2e8f0] rounded-md px-2 py-1 hover:border-emerald-400 hover:text-emerald-700 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : 'Afhandelen'}
    </button>
  )
}
