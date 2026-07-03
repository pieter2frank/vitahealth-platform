import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { BookOpen, Plus, Sparkles, Video, FileText } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { canManageKnowledge } from '@/lib/auth/roles'
import { DOMAIN_LABELS, KNOWLEDGE_STATUS_LABELS, KNOWLEDGE_STATUS_COLORS } from '@/lib/knowledge-domains'

export default async function KennisbankPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('vh_medewerker').select('role').eq('user_id', user?.id ?? '').maybeSingle()
  if (!canManageKnowledge(me?.role)) redirect('/dashboard')

  const { data: docs } = await supabase
    .from('vh_knowledge')
    .select('id, domain, title, content_type, status, source, created_at')
    .order('created_at', { ascending: false })

  const { data: chunks } = await supabase.from('vh_knowledge_chunk').select('knowledge_id')
  const chunkCount: Record<string, number> = {}
  for (const c of chunks ?? []) chunkCount[c.knowledge_id] = (chunkCount[c.knowledge_id] ?? 0) + 1

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

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {!docs || docs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <BookOpen size={32} className="text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#94a3b8]">Nog geen kennis</p>
            <p className="text-xs text-[#94a3b8] mt-1">Voeg je eerste kennisdocument toe en indexeer het.</p>
            <Link
              href="/kennisbank/nieuw"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors mt-4"
            >
              <Plus size={15} />
              Eerste document maken
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
