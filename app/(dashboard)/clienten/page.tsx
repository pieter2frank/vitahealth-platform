import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { UserPlus, Search, X, Send } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { ENROLLMENT_LABELS, ENROLLMENT_COLORS, type EnrollmentStatus } from '@/lib/enrollment'

export default async function ClientenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('vh_client')
    .select('id, first_name, last_name, email, phone, city, created_at, enrollment_status')
    .order('last_name', { ascending: true })

  if (q) {
    query = query.or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (status) {
    query = query.eq('enrollment_status', status)
  }

  const { data: clients, error } = await query

  const activeStatusLabel = status ? (ENROLLMENT_LABELS[status] ?? status) : null

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Cliënten</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            {clients?.length ?? 0} cliënt{(clients?.length ?? 0) !== 1 ? 'en' : ''} gevonden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/uitnodigen"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1f1683] bg-white px-4 py-2 text-sm font-medium text-[#1f1683] hover:bg-[#eef4ff] transition-colors"
          >
            <Send size={15} />
            Uitnodiging sturen
          </Link>
          <Link
            href="/clienten/nieuw"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            <UserPlus size={16} />
            Nieuwe cliënt
          </Link>
        </div>
      </div>

      {/* Zoekbalk + actief statusfilter */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <form method="GET" className="flex items-center gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Zoek op naam of e-mail..."
              className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
            />
          </div>
        </form>

        {activeStatusLabel && (
          <Link
            href={q ? `/clienten?q=${encodeURIComponent(q)}` : '/clienten'}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#1f1683] bg-[#eef4ff] px-3 py-1 text-xs font-medium text-[#1f1683] hover:bg-[#dde9ff] transition-colors"
          >
            Status: {activeStatusLabel}
            <X size={12} />
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">
            Fout bij ophalen cliënten.
          </div>
        ) : !clients || clients.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#94a3b8] mb-3">
              {q ? `Geen cliënten gevonden voor "${q}".` : 'Nog geen cliënten aangemaakt.'}
            </p>
            <Link
              href="/clienten/nieuw"
              className="inline-flex items-center gap-1.5 text-sm text-[#1f1683] hover:underline"
            >
              <UserPlus size={14} />
              Eerste cliënt aanmaken
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Naam</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Stad</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Aangemaakt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {clients.map((c) => (
                <ClickableRow key={c.id} href={`/clienten/${c.id}`} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748b]">{c.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.enrollment_status && (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${ENROLLMENT_COLORS[c.enrollment_status as EnrollmentStatus] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {ENROLLMENT_LABELS[c.enrollment_status as EnrollmentStatus] ?? c.enrollment_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
