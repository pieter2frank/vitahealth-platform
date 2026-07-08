import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { BookOpen, Plus, Sparkles, Video, FileText, GraduationCap } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { requireRolePage } from '@/lib/auth/guard'
import { DOMAIN_LABELS, KNOWLEDGE_STATUS_LABELS, KNOWLEDGE_STATUS_COLORS, CASE_SOURCE } from '@/lib/knowledge-domains'

export default async function KennisbankPage({ searchParams }: { searchParams: Promise<{ bron?: string }> }) {
  const { bron } = await searchParams
  await requireRolePage(['admin', 'arts', 'leefstijlarts'])
  const supabase = await createClient()

  const { data: allDocs } = await supabase
    .from('vh_knowledge')
    .select('id, domain, title, content_type, status, source, created_at')
    .order('created_at', { ascending: false })

  const isCase = (source: string | null) => source === CASE_SOURCE
  const caseCount = (allDocs ?? []).filter(d => isCase(d.source)).length
  const totalCount = (allDocs ?? []).length

  const docs = (allDocs ?? []).filter(d =>
    bron === 'casus' ? isCase(d.source) : bron === 'overig' ? !isCase(d.source) : true)

  const { data: chunks } = await supabase.from('vh_knowledge_chunk').select('knowledge_id')
  const chunkCount: Record<string, number> = {}
  for (const c of chunks ?? []) chunkCount[c.knowledge_id] = (chunkCount[c.knowledge_id] ?? 0) + 1

  const filters = [
    { key: '',      label: 'Alle',      count: totalCount },
    { key: 'casus', label: 'Casussen',  count: caseCount },
    { key: 'overig', label: 'Overige',  count: totalCount - caseCount },
  ]

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Kennisbank</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Gecureerde leefstijlkennis die het AI-advies voedt (RAG)
          </p>
        </div>
        <Link
          href="/kennisbank/nieuw"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
        >
          <Plus size={15} />
          Nieuw kennisdocument
        </Link>
      </div>

      {totalCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {filters.map(f => {
            const active = (bron ?? '') === f.key
            return (
              <Link
                key={f.key || 'alle'}
                href={f.key ? `/kennisbank?bron=${f.key}` : '/kennisbank'}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#1f1683] bg-[#eef4ff] text-[#1f1683]'
                    : 'border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]'
                }`}
              >
                {f.key === 'casus' && <GraduationCap size={12} />}
                {f.label}
                <span className={active ? 'text-[#1f1683]' : 'text-[#94a3b8]'}>{f.count}</span>
              </Link>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {!docs || docs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <BookOpen size={32} className="text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#94a3b8]">
              {totalCount > 0 ? 'Geen documenten in dit filter' : 'Nog geen kennis'}
            </p>
            <p className="text-xs text-[#94a3b8] mt-1">
              {totalCount > 0 ? 'Kies een ander filter of maak een nieuw document.' : 'Voeg je eerste kennisdocument toe en indexeer het.'}
            </p>
            <Link
              href="/kennisbank/nieuw"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors mt-4"
            >
              <Plus size={15} />
              {totalCount > 0 ? 'Nieuw document' : 'Eerste document maken'}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Titel</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Domein</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Geïndexeerd</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegevoegd</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {docs.map((d) => {
                const count = chunkCount[d.id] ?? 0
                return (
                  <ClickableRow key={d.id} href={`/kennisbank/${d.id}`} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1e293b] flex items-center gap-1.5">
                        {d.content_type === 'video'
                          ? <Video size={13} className="text-[#94a3b8] shrink-0" />
                          : <FileText size={13} className="text-[#94a3b8] shrink-0" />}
                        {d.title}
                        {isCase(d.source) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium text-[#1f1683]">
                            <GraduationCap size={10} /> Casus
                          </span>
                        )}
                      </p>
                      {d.source && <p className="text-xs text-[#94a3b8] mt-0.5">{d.source}</p>}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{DOMAIN_LABELS[d.domain] ?? d.domain}</td>
                    <td className="px-4 py-3">
                      {count > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                          <Sparkles size={13} className="text-[#17e4a1]" />
                          {count}
                        </span>
                      ) : (
                        <span className="text-[#cbd5e1]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${KNOWLEDGE_STATUS_COLORS[d.status] ?? ''}`}>
                        {KNOWLEDGE_STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                  </ClickableRow>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
