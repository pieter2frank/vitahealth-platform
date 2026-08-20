import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { BookOpen, Plus, GraduationCap, Highlighter, GitBranch, FileText } from 'lucide-react'
import { requireRolePage } from '@/lib/auth/guard'
import { CASE_SOURCE, isAnnotatedCaseSource } from '@/lib/knowledge-domains'
import { KnowledgeTable } from './KnowledgeTable'

export default async function KennisbankPage({ searchParams }: { searchParams: Promise<{ bron?: string }> }) {
  const { bron } = await searchParams
  await requireRolePage(['admin', 'arts', 'leefstijlarts'])
  const supabase = await createClient()

  const { data: allDocs } = await supabase
    .from('vh_knowledge')
    .select('id, domain, title, content_type, status, source, created_at')
    .order('created_at', { ascending: false })

  const isCase = (source: string | null) => source === CASE_SOURCE
  const isAnnotated = (source: string | null) => isAnnotatedCaseSource(source)
  const caseCount = (allDocs ?? []).filter(d => isCase(d.source)).length
  const annotatedCount = (allDocs ?? []).filter(d => isAnnotated(d.source)).length
  const totalCount = (allDocs ?? []).length

  const docs = (allDocs ?? []).filter(d =>
    bron === 'casus'       ? isCase(d.source)
      : bron === 'geannoteerd' ? isAnnotated(d.source)
      : bron === 'overig'      ? (!isCase(d.source) && !isAnnotated(d.source))
      : true)

  const { data: chunks } = await supabase.from('vh_knowledge_chunk').select('knowledge_id')
  const chunkCount: Record<string, number> = {}
  for (const c of chunks ?? []) chunkCount[c.knowledge_id] = (chunkCount[c.knowledge_id] ?? 0) + 1

  const filters = [
    { key: '',            label: 'Alle',         count: totalCount },
    { key: 'casus',       label: 'Casussen',     count: caseCount },
    { key: 'geannoteerd', label: 'Geannoteerd',  count: annotatedCount },
    { key: 'overig',      label: 'Overige',      count: totalCount - caseCount - annotatedCount },
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
        <div className="flex items-center gap-2">
          <Link
            href="/kennisbank/sjabloon"
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1e293b] hover:bg-[#f8fafc] transition-colors"
          >
            <FileText size={15} />
            Adviessjabloon
          </Link>
          <Link
            href="/kennisbank/regels"
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1e293b] hover:bg-[#f8fafc] transition-colors"
          >
            <GitBranch size={15} />
            Als-dan richtlijnen
          </Link>
          <Link
            href="/kennisbank/nieuw"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            <Plus size={15} />
            Nieuw kennisdocument
          </Link>
        </div>
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
                {f.key === 'geannoteerd' && <Highlighter size={12} />}
                {f.label}
                <span className={active ? 'text-[#1f1683]' : 'text-[#94a3b8]'}>{f.count}</span>
              </Link>
            )
          })}
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
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
        </div>
      ) : (
        <KnowledgeTable docs={docs} chunkCount={chunkCount} />
      )}
    </div>
  )
}
