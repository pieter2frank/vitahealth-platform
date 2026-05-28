import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Stethoscope, Search } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'

export default async function ArbodienstenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('vh_arbo')
    .select('id, name, contact_name, email, phone, city, created_at')
    .order('name', { ascending: true })

  if (q) query = query.ilike('name', `%${q}%`)

  const { data: arbos, error } = await query

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Arbodiensten</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            {arbos?.length ?? 0} arbodienst{(arbos?.length ?? 0) !== 1 ? 'en' : ''} gevonden.
          </p>
        </div>
        <Link
          href="/arbodiensten/nieuw"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
        >
          <Stethoscope size={16} />
          Nieuwe arbodienst
        </Link>
      </div>

      <form method="GET" className="mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Zoek op naam..."
            className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
          />
        </div>
      </form>

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">Fout bij ophalen arbodiensten.</div>
        ) : !arbos || arbos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#94a3b8] mb-3">
              {q ? `Geen arbodiensten gevonden voor "${q}".` : 'Nog geen arbodiensten aangemaakt.'}
            </p>
            <Link href="/arbodiensten/nieuw" className="inline-flex items-center gap-1.5 text-sm text-[#1f1683] hover:underline">
              <Stethoscope size={14} />
              Eerste arbodienst aanmaken
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Naam</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Contactpersoon</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Stad</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Aangemaakt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {arbos.map((a) => (
                <ClickableRow key={a.id} href={`/arbodiensten/${a.id}`} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{a.name}</td>
                  <td className="px-4 py-3 text-[#64748b]">{a.contact_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748b]">{a.email ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748b]">{a.city ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(a.created_at)}</td>
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
