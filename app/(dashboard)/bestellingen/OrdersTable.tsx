'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Loader2, XCircle, AlertTriangle } from 'lucide-react'
import { formatEuro } from '@/lib/payments/pricing'

export interface OrderRow {
  id: string
  createdAt: string
  packageName: string
  buyerName: string | null
  email: string
  amountCents: number
  status: string
  paidAt: string | null
  refundedAt: string | null
  stopRequestedAt: string | null
}

const FILTERS = [
  { key: 'all',      label: 'Alle' },
  { key: 'paid',     label: 'Betaald' },
  { key: 'stop',     label: 'Stopverzoek' },
  { key: 'refunded', label: 'Terugbetaald' },
  { key: 'other',    label: 'Overig' },
] as const

type FilterKey = typeof FILTERS[number]['key']

const STATUS_BADGE: Record<string, string> = {
  paid:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  refunded: 'bg-slate-100 text-slate-500 border-slate-300',
  open:     'bg-amber-50 text-amber-700 border-amber-200',
  failed:   'bg-red-50 text-red-700 border-red-200',
  expired:  'bg-slate-50 text-slate-500 border-slate-200',
  canceled: 'bg-slate-50 text-slate-500 border-slate-200',
}
const STATUS_LABEL: Record<string, string> = {
  paid: 'Betaald', refunded: 'Terugbetaald', open: 'Open',
  failed: 'Mislukt', expired: 'Verlopen', canceled: 'Geannuleerd',
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy', { locale: nl }) } catch { return '—' }
}

export function OrdersTable({ orders }: { orders: OrderRow[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [refundTarget, setRefundTarget] = useState<OrderRow | null>(null)

  const visible = orders.filter(o => {
    if (filter === 'all') return true
    if (filter === 'paid') return o.status === 'paid'
    if (filter === 'refunded') return o.status === 'refunded'
    if (filter === 'stop') return o.status === 'paid' && o.stopRequestedAt
    return !['paid', 'refunded'].includes(o.status)
  })

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              filter === f.key
                ? 'border-[#1f1683] bg-[#eef4ff] text-[#1f1683]'
                : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3">Datum</th>
                <th className="px-4 py-3">Klant</th>
                <th className="px-4 py-3">Pakket</th>
                <th className="px-4 py-3 text-right">Bedrag</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actie</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[#94a3b8]">Geen bestellingen in deze weergave.</td></tr>
              )}
              {visible.map(o => (
                <tr key={o.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc]">
                  <td className="whitespace-nowrap px-4 py-3 text-[#64748b]">{fmt(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#1e293b]">{o.buyerName ?? '—'}</div>
                    <div className="text-xs text-[#94a3b8]">{o.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{o.packageName}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-[#1e293b]">{formatEuro(o.amountCents)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[o.status] ?? 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {o.status === 'paid' && o.stopRequestedAt && (
                        <span className="inline-flex w-fit items-center gap-1 text-[11px] font-medium text-amber-600">
                          <AlertTriangle size={11} /> Stop gevraagd
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === 'paid' ? (
                      <button
                        onClick={() => setRefundTarget(o)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          o.stopRequestedAt
                            ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600'
                        }`}
                      >
                        Terugbetalen
                      </button>
                    ) : (
                      <span className="text-xs text-[#cbd5e1]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {refundTarget && (
        <RefundModal
          order={refundTarget}
          onClose={() => setRefundTarget(null)}
          onDone={() => { setRefundTarget(null); router.refresh() }}
        />
      )}
    </>
  )
}

function RefundModal({ order, onClose, onDone }: { order: OrderRow; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState('')

  async function confirm() {
    setState('sending')
    try {
      const res = await fetch('/api/payments/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, reason }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Terugbetalen mislukt.'); setState('error'); return }
      onDone()
    } catch { setError('Terugbetalen mislukt.'); setState('error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#1e293b]">Bestelling terugbetalen</h2>
        <p className="mt-2 text-sm text-[#64748b] leading-relaxed">
          Je betaalt <strong>{formatEuro(order.amountCents)}</strong> terug aan <strong>{order.buyerName ?? order.email}</strong>.
          Het traject wordt beëindigd (status <em>geannuleerd</em>) en de klant ontvangt een creditfactuur. Dit kan niet ongedaan worden gemaakt.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reden (optioneel, voor intern gebruik)"
          rows={2}
          className="mt-4 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#1f1683] focus:outline-none"
        />
        {state === 'error' && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={state === 'sending'} className="rounded-lg px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">
            Annuleren
          </button>
          <button
            onClick={confirm}
            disabled={state === 'sending'}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {state === 'sending' && <Loader2 size={14} className="animate-spin" />}
            Terugbetalen &amp; beëindigen
          </button>
        </div>
      </div>
    </div>
  )
}
