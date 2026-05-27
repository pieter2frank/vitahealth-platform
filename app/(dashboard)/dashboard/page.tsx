import { createClient } from '@/lib/supabase/server'
import { TestTube2, Users, Building2, Package } from 'lucide-react'
import Link from 'next/link'

async function getStats(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [
    { count: total },
    { count: received },
    { count: assigned },
    { count: retour },
    { count: sent },
    { count: results },
  ] = await Promise.all([
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'received'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'retour'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'sent_nightingale'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'results_available'),
  ])
  return { total, received, assigned, retour, sent, results }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const stats = await getStats(supabase)

  const { data: recentKits } = await supabase
    .from('vh_testkit')
    .select('id, barcode, date, status, assigned, vh_client(first_name, last_name), vh_company(name), vh_arbo(name)')
    .order('date', { ascending: false })
    .limit(5)

  const statCards = [
    { label: 'Totaal testkits', value: stats.total ?? 0, icon: TestTube2, color: 'text-[#1f1683]', bg: 'bg-[#eef4ff]' },
    { label: 'Ontvangen', value: stats.received ?? 0, icon: TestTube2, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Toegewezen', value: stats.assigned ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Retour', value: stats.retour ?? 0, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Verzonden NHG', value: stats.sent ?? 0, icon: Building2, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Resultaten', value: stats.results ?? 0, icon: TestTube2, color: 'text-green-600', bg: 'bg-green-50' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Overzicht van het biomarker platform.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[#64748b] uppercase tracking-wide">{label}</p>
              <div className={`rounded-lg p-1.5 ${bg}`}>
                <Icon size={14} className={color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-[#1e293b]">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent testkits */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h2 className="font-semibold text-[#1e293b]">Recente testkits</h2>
          <Link href="/testkits" className="text-sm text-[#1f1683] hover:underline">
            Alles bekijken →
          </Link>
        </div>
        {!recentKits || recentKits.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#94a3b8]">
            Nog geen testkits ingevoerd.{' '}
            <Link href="/testkits/intake" className="text-[#1f1683] hover:underline">
              Eerste kit inscannen →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {recentKits.map((kit) => {
              const assignedTo = (kit.vh_client as { first_name: string; last_name: string } | null)
                ? `${(kit.vh_client as { first_name: string; last_name: string }).first_name} ${(kit.vh_client as { first_name: string; last_name: string }).last_name}`
                : (kit.vh_company as { name: string } | null)?.name
                ?? (kit.vh_arbo as { name: string } | null)?.name
                ?? null

              return (
                <Link
                  key={kit.id}
                  href={`/testkits/${kit.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#f8fafc] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[#1e293b] font-mono">{kit.barcode}</p>
                    {assignedTo && (
                      <p className="text-xs text-[#64748b]">{assignedTo}</p>
                    )}
                  </div>
                  <StatusBadge status={kit.status as string} />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    received:         { label: 'Ontvangen',     cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    assigned:         { label: 'Toegewezen',    cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    retour:           { label: 'Retour',         cls: 'bg-purple-100 text-purple-700 border-purple-200' },
    sent_nightingale: { label: 'Verzonden NHG', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    results_available:{ label: 'Resultaten',    cls: 'bg-green-100 text-green-700 border-green-200' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}
