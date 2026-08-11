import { createAdminClient } from '@/lib/supabase/admin'
import { requireRolePage } from '@/lib/auth/guard'
import { formatEuro } from '@/lib/payments/pricing'
import { Receipt, CheckCircle2, Ban, Clock } from 'lucide-react'
import { OrdersTable, type OrderRow } from './OrdersTable'

// Bestellingen-beheer: overzicht van orders met status, stopverzoeken en de
// terugbetaal-actie. Voor personeel (admin, arts, leefstijlarts, medewerker).
export default async function BestellingenPage() {
  await requireRolePage(['admin', 'arts', 'leefstijlarts', 'medewerker'])

  const admin = createAdminClient()
  const { data } = await admin
    .from('vh_order')
    .select('id, created_at, package_name, buyer_first_name, buyer_last_name, email, amount_cents, status, paid_at, refunded_at, stop_requested_at, mollie_payment_id')
    .order('created_at', { ascending: false })
    .limit(500)

  const orders: OrderRow[] = (data ?? []).map(o => ({
    id:                o.id as string,
    createdAt:         o.created_at as string,
    packageName:       (o.package_name as string) ?? '—',
    buyerName:         [o.buyer_first_name, o.buyer_last_name].filter(Boolean).join(' ').trim() || null,
    email:             (o.email as string) ?? '',
    amountCents:       (o.amount_cents as number) ?? 0,
    status:            (o.status as string) ?? 'open',
    paidAt:            (o.paid_at as string | null) ?? null,
    refundedAt:        (o.refunded_at as string | null) ?? null,
    stopRequestedAt:   (o.stop_requested_at as string | null) ?? null,
  }))

  const paid       = orders.filter(o => o.status === 'paid')
  const refunded   = orders.filter(o => o.status === 'refunded')
  const stopOpen   = paid.filter(o => o.stopRequestedAt)
  const paidRevenue = paid.reduce((s, o) => s + o.amountCents, 0)

  const stats = [
    { icon: CheckCircle2, label: 'Betaald', value: `${paid.length}`, sub: formatEuro(paidRevenue), color: 'text-emerald-600' },
    { icon: Clock,        label: 'Openstaand stopverzoek', value: `${stopOpen.length}`, sub: 'te verwerken', color: 'text-amber-600' },
    { icon: Ban,          label: 'Terugbetaald', value: `${refunded.length}`, sub: 'geannuleerd', color: 'text-slate-500' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff]">
          <Receipt size={20} className="text-[#1f1683]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1e293b]">Bestellingen</h1>
          <p className="text-sm text-[#64748b]">Betalingen, stopverzoeken en terugbetalingen.</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <div className="flex items-center gap-2 text-[#64748b]">
              <s.icon size={16} className={s.color} />
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-[#1e293b]">{s.value}</p>
            <p className="text-xs text-[#94a3b8]">{s.sub}</p>
          </div>
        ))}
      </div>

      <OrdersTable orders={orders} />
    </div>
  )
}
