import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatEuro } from '@/lib/payments/pricing'
import { ShieldCheck, Stethoscope, ArrowRight, AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Pakketten — Vita Health' }

interface Props { searchParams: Promise<{ onbekend?: string }> }

export default async function PakkettenPage({ searchParams }: Props) {
  const { onbekend } = await searchParams
  const admin = createAdminClient()
  const { data: packages } = await admin
    .from('vh_package')
    .select('slug, name, description, price_cents, includes_consult')
    .eq('active', true)
    .order('sort_order', { ascending: true })

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-[#1e293b]">Kies je Vita Health Check</h1>
          <p className="mt-1 text-sm text-[#64748b]">Selecteer een pakket om te starten. Betalen doe je veilig via Mollie.</p>
        </div>

        {onbekend && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-800">
              Het gekozen pakket bestaat niet (meer). Kies hieronder een van de beschikbare pakketten.
            </p>
          </div>
        )}

        {(packages ?? []).length === 0 ? (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-10 text-center text-sm text-[#94a3b8] shadow-sm">
            Er zijn op dit moment geen pakketten beschikbaar.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {(packages ?? []).map(p => (
              <Link key={p.slug} href={`/bestellen/${p.slug}`}
                className="group flex flex-col rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition-colors hover:border-[#1f1683]">
                <h2 className="text-base font-semibold text-[#1e293b]">{p.name}</h2>
                {p.description && <p className="mt-1 flex-1 text-sm text-[#64748b]">{p.description}</p>}
                {p.includes_consult && (
                  <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0d7a5f]">
                    <Stethoscope size={13} /> Inclusief consult
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-lg font-bold text-[#1e293b]">{formatEuro(p.price_cents)}<span className="ml-1 text-xs font-normal text-[#94a3b8]">incl. btw</span></span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f1683] px-3 py-2 text-sm font-medium text-white transition-colors group-hover:bg-[#1a1270]">
                    Kies <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-[#94a3b8]">
          <ShieldCheck size={13} /> Veilig betalen via Mollie · daarna rond je de intake af.
        </p>
      </div>
    </main>
  )
}
