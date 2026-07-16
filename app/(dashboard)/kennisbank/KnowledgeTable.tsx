'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import {
  DOMAIN_LABELS, KNOWLEDGE_STATUS_LABELS, KNOWLEDGE_STATUS_COLORS,
  CASE_SOURCE, isAnnotatedCaseSource,
} from '@/lib/knowledge-domains'
import {
  Sparkles, Video, FileText, GraduationCap, Highlighter,
  Loader2, CheckCircle2, AlertTriangle, X,
} from 'lucide-react'

export interface KnowledgeDoc {
  id: string
  domain: string
  title: string
  content_type: string
  status: string
  source: string | null
  created_at: string
}

const STATUS_OPTIONS = [
  { value: 'active',   label: 'Actief' },
  { value: 'draft',    label: 'Concept' },
  { value: 'archived', label: 'Gearchiveerd' },
]

export function KnowledgeTable({ docs, chunkCount }: { docs: KnowledgeDoc[]; chunkCount: Record<string, number> }) {
  const router = useRouter()
  const [sel, setSel]       = useState<Set<string>>(new Set())
  const [status, setStatus] = useState('active')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [notice, setNotice] = useState('')

  const isCase = (s: string | null) => s === CASE_SOURCE
  const isAnn  = (s: string | null) => isAnnotatedCaseSource(s)

  function toggle(id: string) {
    setSel(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
    setError(''); setNotice('')
  }
  function toggleAll() {
    setSel(p => (p.size === docs.length ? new Set() : new Set(docs.map(d => d.id))))
    setError(''); setNotice('')
  }

  async function apply() {
    setBusy(true); setError(''); setNotice('')
    const res = await fetch('/api/knowledge/bulk-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [...sel], status }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Bijwerken mislukt.'); return }
    const label = STATUS_OPTIONS.find(s => s.value === status)?.label ?? status
    setNotice(`${j.updated} document${j.updated === 1 ? '' : 'en'} op “${label}” gezet.`)
    setSel(new Set())
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {/* Bulk-actiebalk — alleen zichtbaar bij een selectie */}
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#c7d7fd] bg-[#eef4ff] px-4 py-3">
          <span className="text-sm font-medium text-[#1f1683]">{sel.size} geselecteerd</span>
          <span className="text-sm text-[#64748b]">Status wijzigen naar</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-[#c7d7fd] bg-white px-3 py-1.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={apply}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Toepassen
          </button>
          <button onClick={() => setSel(new Set())} className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1e293b]">
            <X size={12} /> Selectie wissen
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
          <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1f1683]"
                  checked={docs.length > 0 && sel.size === docs.length}
                  onChange={toggleAll}
                  aria-label="Alles selecteren"
                />
              </th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Titel</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Domein</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Geïndexeerd</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegevoegd</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {docs.map(d => {
              const count = chunkCount[d.id] ?? 0
              return (
                <tr
                  key={d.id}
                  onClick={() => router.push(`/kennisbank/${d.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[#f8fafc]"
                >
                  {/* Checkbox mag de rij niet openen */}
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#1f1683]"
                      checked={sel.has(d.id)}
                      onChange={() => toggle(d.id)}
                      aria-label={`Selecteer ${d.title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <p className="flex items-center gap-1.5 font-medium text-[#1e293b]">
                      {d.content_type === 'video'
                        ? <Video size={13} className="shrink-0 text-[#94a3b8]" />
                        : <FileText size={13} className="shrink-0 text-[#94a3b8]" />}
                      {d.title}
                      {isCase(d.source) && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-1.5 py-0.5 text-[10px] font-medium text-[#1f1683]">
                          <GraduationCap size={10} /> Casus
                        </span>
                      )}
                      {isAnn(d.source) && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          <Highlighter size={10} /> Geannoteerd
                        </span>
                      )}
                    </p>
                    {d.source && <p className="mt-0.5 text-xs text-[#94a3b8]">{d.source}</p>}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{DOMAIN_LABELS[d.domain] ?? d.domain}</td>
                  <td className="px-4 py-3">
                    {count > 0 ? (
                      <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                        <Sparkles size={13} className="text-[#17e4a1]" />{count}
                      </span>
                    ) : <span className="text-[#cbd5e1]">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${KNOWLEDGE_STATUS_COLORS[d.status] ?? ''}`}>
                      {KNOWLEDGE_STATUS_LABELS[d.status] ?? d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 text-right text-xs text-[#94a3b8]">→</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
