'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Sparkles, Wand2, Pencil, X, Save, Trash2, CheckCircle2, RotateCcw, ShieldCheck, AlertTriangle, BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'

interface Advice {
  id: string
  status: string
  content: { text?: string } | null
  model: string | null
  sources: string[] | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

interface Props {
  clientId: string
  initialAdvices: Advice[]
}

const SELECT = 'id, status, content, model, sources, created_by, approved_by, approved_at, created_at'

const STATUS_BADGE: Record<string, string> = {
  draft:    'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  sent:     'bg-[#eef4ff] text-[#1f1683] border-[#c7d7fd]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Concept', approved: 'Goedgekeurd', sent: 'Verzonden',
}

// ─── Bronnen-paneel (provenance) ──────────────────────────────────────────────
// Toont de exact gebruikte kennis-fragmenten waarop dit advies is gebaseerd.
// Fragmenten worden lui geladen bij openen; verwijderde bronnen worden herkend.

interface SourceChunk {
  id:       string
  domain:   string
  content:  string
  title:    string | null
  source:   string | null
  evidence: string | null
  missing?: boolean
}

function SourcesPanel({ sourceIds }: { sourceIds: string[] }) {
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState(false)
  const [chunks,  setChunks]  = useState<SourceChunk[] | null>(null)
  const [error,   setError]   = useState('')

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || chunks !== null) return

    setLoading(true); setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('vh_knowledge_chunk')
      .select('id, domain, content, knowledge:vh_knowledge ( title, source, evidence )')
      .in('id', sourceIds)
    setLoading(false)
    if (err) { setError(err.message); return }

    // Behoud de volgorde uit `sources` ([1]..[N] zoals aan het model gegeven).
    type Row = { id: string; domain: string; content: string; knowledge: { title: string | null; source: string | null; evidence: string | null } | { title: string | null; source: string | null; evidence: string | null }[] | null }
    const byId = new Map((data as Row[] ?? []).map(r => {
      const k = Array.isArray(r.knowledge) ? r.knowledge[0] : r.knowledge
      return [r.id, {
        id: r.id, domain: r.domain, content: r.content,
        title: k?.title ?? null, source: k?.source ?? null, evidence: k?.evidence ?? null,
      } as SourceChunk]
    }))
    setChunks(sourceIds.map(id => byId.get(id) ?? { id, domain: '', content: '', title: null, source: null, evidence: null, missing: true }))
  }

  return (
    <div className="mt-3 border-t border-[#f1f5f9] pt-3">
      <button onClick={toggle}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748b] hover:text-[#1f1683] transition-colors">
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <BookOpen size={13} />
        Bronnen ({sourceIds.length})
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          {loading && <p className="text-xs text-[#94a3b8]">Bronnen laden…</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {chunks?.map((c, i) => (
            <div key={c.id + i} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
              {c.missing ? (
                <p className="text-xs text-[#94a3b8] italic flex items-center gap-1.5">
                  <span className="font-semibold text-[#64748b]">[{i + 1}]</span>
                  Bron niet meer beschikbaar (kennisdocument verwijderd).
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-semibold text-[#64748b]">[{i + 1}]</span>
                    {c.domain && (
                      <span className="inline-flex items-center rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#1f1683]">
                        {c.domain}
                      </span>
                    )}
                    {c.title && <span className="text-xs font-medium text-[#1e293b]">{c.title}</span>}
                    {c.evidence && <span className="text-[10px] text-[#94a3b8]">· {c.evidence}</span>}
                  </div>
                  <p className="text-xs text-[#475569] whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                    {c.content}
                  </p>
                  {c.source && <p className="mt-1.5 text-[10px] text-[#94a3b8]">Bron: {c.source}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AdviceCard({ advice, onChanged, onDeleted }: {
  advice: Advice
  onChanged: () => void
  onDeleted: (id: string) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [text, setText]         = useState(advice.content?.text ?? '')
  const [busy, setBusy]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]       = useState('')

  const isDraft = advice.status === 'draft'

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setError('')
    const res = await fetch(`/api/advice/${advice.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Actie mislukt.'); return false }
    return true
  }

  async function handleSaveText() {
    if (await patch({ text })) { setEditing(false); onChanged() }
  }
  async function handleApprove() { if (await patch({ action: 'approve' })) onChanged() }
  async function handleReopen()  { if (await patch({ action: 'reopen' }))  onChanged() }

  async function handleDelete() {
    setBusy(true)
    const res = await fetch(`/api/advice/${advice.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Verwijderen mislukt.'); setConfirmDelete(false); return }
    onDeleted(advice.id)
  }

  return (
    <div className="border-b border-[#f1f5f9] last:border-b-0">
      <div className="flex items-start justify-between gap-3 px-5 py-3 bg-[#f8fafc]">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[advice.status] ?? ''}`}>
              {STATUS_LABEL[advice.status] ?? advice.status}
            </span>
            <span className="text-[#64748b]">{formatDateTime(advice.created_at)}</span>
            {advice.model && <><span className="text-[#cbd5e1]">·</span><span className="text-[#94a3b8]">{advice.model}</span></>}
          </div>
          {advice.approved_by && (
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <ShieldCheck size={11} /> Goedgekeurd door {advice.approved_by}
              {advice.approved_at && ` — ${formatDateTime(advice.approved_at)}`}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!editing && !confirmDelete && isDraft && (
            <>
              <button onClick={() => { setText(advice.content?.text ?? ''); setEditing(true); setError('') }}
                className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1f1683]">
                <Pencil size={11} /> Bewerken
              </button>
              <button onClick={handleApprove} disabled={busy}
                className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50">
                <CheckCircle2 size={12} /> Goedkeuren
              </button>
              <button onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 text-xs text-[#94a3b8] hover:text-red-500">
                <Trash2 size={11} />
              </button>
            </>
          )}
          {!editing && !confirmDelete && !isDraft && (
            <button onClick={handleReopen} disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1f1683] disabled:opacity-50">
              <RotateCcw size={11} /> Heropenen
            </button>
          )}
          {editing && (
            <button onClick={() => { setEditing(false); setError('') }}
              className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1e293b]">
              <X size={11} /> Annuleren
            </button>
          )}
          {confirmDelete && (
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="text-[#64748b]">Verwijderen?</span>
              <button onClick={handleDelete} disabled={busy} className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                {busy ? 'Bezig…' : 'Ja'}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-[#64748b] hover:text-[#1e293b]">Nee</button>
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4">
        {editing ? (
          <div className="space-y-3">
            <textarea value={text} onChange={e => setText(e.target.value)} rows={12}
              className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y leading-relaxed" />
            <div className="flex justify-end">
              <button onClick={handleSaveText} disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] disabled:opacity-50">
                <Save size={14} /> {busy ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#1e293b] whitespace-pre-wrap leading-relaxed">
            {advice.content?.text || <span className="text-[#94a3b8] italic">Geen inhoud.</span>}
          </p>
        )}
        {!editing && advice.sources && advice.sources.length > 0 && (
          <SourcesPanel sourceIds={advice.sources} />
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}

export function AdviceSection({ clientId, initialAdvices }: Props) {
  const { role } = useUser()
  const [advices, setAdvices] = useState<Advice[]>(initialAdvices)
  const [generating, setGenerating] = useState(false)
  const [error, setError]   = useState('')
  const [notice, setNotice] = useState('')

  // Sectie uitsluitend voor arts/leefstijlarts (advies is patiënt-gekoppeld).
  if (!canSeeResults(role)) return null

  async function refresh() {
    const supabase = createClient()
    const { data } = await supabase.from('vh_advice').select(SELECT)
      .eq('client_id', clientId).order('created_at', { ascending: false })
    setAdvices((data ?? []) as Advice[])
  }

  async function handleGenerate() {
    setGenerating(true); setError(''); setNotice('')
    const res = await fetch('/api/advice/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }),
    })
    const data = await res.json().catch(() => ({}))
    setGenerating(false)
    if (!res.ok) { setError(data.error ?? 'Genereren mislukt.'); return }
    setNotice(`Conceptadvies gegenereerd op basis van ${data.chunksUsed} kennisbron${data.chunksUsed === 1 ? '' : 'nen'}.`)
    await refresh()
  }

  return (
    <CollapsibleCard
      className="mt-4"
      icon={<Sparkles size={15} className="shrink-0 text-[#17e4a1]" />}
      title={<>AI-advies (concept) {advices.length > 0 && <span className="text-xs font-normal text-[#94a3b8]">({advices.length})</span>}</>}
      actions={
        <button onClick={handleGenerate} disabled={generating}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f1683] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50">
          {generating
            ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Genereren…</>
            : <><Wand2 size={13} /> Genereer advies</>}
        </button>
      }
    >
      <div className="px-5 py-3 border-b border-[#f1f5f9] bg-[#fffdf5]">
        <p className="text-xs text-[#8a6d3b] flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-500" />
          Dit is door AI gegenereerd concept op basis van de kennisbank en het signaalprofiel van de cliënt.
          Een arts moet het beoordelen en goedkeuren voordat het gedeeld wordt. Bevat geen diagnoses of doseringen.
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      {advices.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[#94a3b8]">Nog geen advies gegenereerd voor deze cliënt.</p>
        </div>
      ) : (
        <div>
          {advices.map(a => (
            <AdviceCard key={a.id} advice={a} onChanged={refresh} onDeleted={id => setAdvices(prev => prev.filter(x => x.id !== id))} />
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}
