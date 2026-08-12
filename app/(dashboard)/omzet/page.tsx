import { createAdminClient } from '@/lib/supabase/admin'
import { requireRolePage } from '@/lib/auth/guard'
import { formatEuro } from '@/lib/payments/pricing'
import { subMonths, format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { TrendingUp, Receipt, Percent, ShoppingCart, Wallet, RotateCcw } from 'lucide-react'
import { MonthlyRevenueChart } from './MonthlyRevenueChart'

// Inkomstendashboard: omzet, btw en pakketten in cijfers + grafieken. Alleen admin.
export default async function OmzetPage() {
  await requireRolePage(['admin'])

  const admin = createAdminClient()
  const { data } = await admin
    .from('vh_order')
    .select('status, amount_cents, vat_cents, vat_rate, package_name, paid_at')
    .in('status', ['paid', 'refunded'])
    .limit(5000)

  const rows = data ?? []
  const paid     = rows.filter(o => o.status === 'paid')
  const refunded = rows.filter(o => o.status === 'refunded')

  const grossPaid = paid.reduce((s, o) => s + ((o.amount_cents as number) ?? 0), 0)
  const vatPaid   = paid.reduce((s, o) => s + ((o.vat_cents as number) ?? 0), 0)
  const netPaid   = grossPaid - vatPaid
  const countPaid = paid.length
  const avgOrder  = countPaid ? Math.round(grossPaid / countPaid) : 0
  const grossRefunded = refunded.reduce((s, o) => s + ((o.amount_cents as number) ?? 0), 0)

  // ── Omzet per maand (laatste 12 maanden, op betaaldatum) ─────────────────────
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(now, 11 - i)
    return { key: format(d, 'yyyy-MM'), label: format(d, 'MMM', { locale: nl }) }
  })
  const monthMap = new Map(months.map(m => [m.key, 0]))
  for (const o of paid) {
    const at = o.paid_at as string | null
    if (!at) continue
    const key = format(new Date(at), 'yyyy-MM')
    if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) ?? 0) + ((o.amount_cents as number) ?? 0))
  }
  const monthly = months.map(m => ({ label: m.label, value: monthMap.get(m.key) ?? 0 }))

  // ── Per pakket ───────────────────────────────────────────────────────────────
  const pkgMap = new Map<string, { count: number; gross: number; vat: number }>()
  for (const o of paid) {
    const name = (o.package_name as string) ?? '—'
    const cur = pkgMap.get(name) ?? { count: 0, gross: 0, vat: 0 }
    cur.count += 1
    cur.gross += (o.amount_cents as number) ?? 0
    cur.vat   += (o.vat_cents as number) ?? 0
    pkgMap.set(name, cur)
  }
  const packages = [...pkgMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.gross - a.gross)
  const pkgMaxGross = Math.max(1, ...packages.map(p => p.gross))
  const PKG_COLORS = ['#1f1683', '#17e4a1', '#3b55c8', '#0ea5e9', '#8b5cf6', '#f59e0b']

  // ── Btw per tarief ─────────────────────────────────────────────────────────────
  const vatMap = new Map<number, { net: number; vat: number }>()
  for (const o of paid) {
    const rate = Number(o.vat_rate ?? 0)
    const gross = (o.amount_cents as number) ?? 0
    const vat = (o.vat_cents as number) ?? 0
    const cur = vatMap.get(rate) ?? { net: 0, vat: 0 }
    cur.net += gross - vat
    cur.vat += vat
    vatMap.set(rate, cur)
  }
  const vatRates = [...vatMap.entries()].map(([rate, v]) => ({ rate, ...v })).sort((a, b) => a.rate - b.rate)

  const kpis = [
    { icon: TrendingUp,   label: 'Netto-omzet (incl. btw)', value: formatEuro(grossPaid),  color: 'text-[#1f1683]' },
    { icon: Receipt,      label: 'Omzet excl. btw',         value: formatEuro(netPaid),    color: 'text-[#3b55c8]' },
    { icon: Percent,      label: 'Af te dragen btw',        value: formatEuro(vatPaid),    color: 'text-emerald-600' },
    { icon: ShoppingCart, label: 'Betaalde bestellingen',   value: `${countPaid}`,         color: 'text-sky-600' },
    { icon: Wallet,       label: 'Gem. orderwaarde',        value: formatEuro(avgOrder),   color: 'text-violet-600' },
    { icon: RotateCcw,    label: 'Terugbetaald',            value: formatEuro(grossRefunded), sub: `${refunded.length} order(s)`, color: 'text-slate-500' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff]">
          <TrendingUp size={20} className="text-[#1f1683]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1e293b]">Omzet &amp; btw</h1>
          <p className="text-sm text-[#64748b]">Inkomsten, af te dragen btw en verkochte pakketten.</p>
        </div>
      </div>

      {/* KPI's */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {kpis.map(k => (
          <div key={k.label} className="rounded-xl border border-[#e2e8f0] bg-white p-4">
            <div className="flex items-center gap-2 text-[#64748b]">
              <k.icon size={16} className={k.color} />
              <span className="text-xs font-medium">{k.label}</span>
            </div>
            <p className="mt-1.5 text-2xl font-bold text-[#1e293b]">{k.value}</p>
            {k.sub && <p className="text-xs text-[#94a3b8]">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Omzet per maand */}
      <div className="mb-6 rounded-xl border border-[#e2e8f0] bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-[#1e293b]">Omzet per maand</h2>
        <p className="mb-4 text-xs text-[#94a3b8]">Betaalde bestellingen (incl. btw), laatste 12 maanden.</p>
        <MonthlyRevenueChart data={monthly} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Per pakket */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-[#1e293b]">Omzet per pakket</h2>
          {packages.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94a3b8]">Nog geen betaalde bestellingen.</p>
          ) : (
            <div className="space-y-4">
              {packages.map((p, i) => (
                <div key={p.name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-[#1e293b]">{p.name}</span>
                    <span className="shrink-0 tabular-nums text-[#64748b]">
                      {formatEuro(p.gross)} <span className="text-[#cbd5e1]">·</span> {p.count}×
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f1f5f9]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(3, (p.gross / pkgMaxGross) * 100)}%`, backgroundColor: PKG_COLORS[i % PKG_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Btw per tarief */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-[#1e293b]">Btw per tarief</h2>
          {vatRates.length === 0 ? (
            <p className="py-6 text-center text-sm text-[#94a3b8]">Nog geen betaalde bestellingen.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-left text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                    <th className="pb-2">Tarief</th>
                    <th className="pb-2 text-right">Grondslag (excl.)</th>
                    <th className="pb-2 text-right">Btw</th>
                  </tr>
                </thead>
                <tbody>
                  {vatRates.map(v => (
                    <tr key={v.rate} className="border-b border-[#f1f5f9] last:border-0">
                      <td className="py-2.5 font-medium text-[#1e293b]">{v.rate}%</td>
                      <td className="py-2.5 text-right tabular-nums text-[#64748b]">{formatEuro(v.net)}</td>
                      <td className="py-2.5 text-right tabular-nums font-medium text-[#1e293b]">{formatEuro(v.vat)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#e2e8f0]">
                    <td className="py-2.5 font-semibold text-[#1e293b]">Totaal</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[#1e293b]">{formatEuro(netPaid)}</td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[#1f1683]">{formatEuro(vatPaid)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
