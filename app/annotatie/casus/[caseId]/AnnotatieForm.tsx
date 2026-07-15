'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { FOLLOWUP_DOMAINS, type AnnotationFields } from '@/lib/annotation'
import {
  FileText, Save, Send, CheckCircle2, AlertTriangle, Loader2, ExternalLink,
  Highlighter, Trash2, X, GraduationCap,
} from 'lucide-react'

interface Highlight { id: string; selected_text: string; note: string | null }

interface Props {
  roundId:  string
  clientId: string
  caseText: string
  hasPdf:   boolean
  initial:  AnnotationFields & { status: string }
  initialHighlights: Highlight[]
}

// Wikkel exacte voorkomens van gemarkeerde tekst in <mark>. Overlappingen worden
// overgeslagen (eerste wint). Klik/hover toont de bijbehorende notitie.
function renderWithMarks(text: string, marks: Highlight[]): React.ReactNode {
  const ranges: { start: number; end: number; m: Highlight }[] = []
  for (const m of marks) {
    const needle = m.selected_text
    if (!needle) continue
    let i = text.indexOf(needle)
    while (i !== -1) { ranges.push({ start: i, end: i + needle.length, m }); i = text.indexOf(needle, i + needle.length) }
  }
  if (!ranges.length) return text
  ranges.sort((a, b) => a.start - b.start)
  const out: React.ReactNode[] = []
  let cursor = 0
  ranges.forEach((r, k) => {
    if (r.start < cursor) return
    if (r.start > cursor) out.push(text.slice(cursor, r.start))
    out.push(
      <mark key={k} title={r.m.note ?? 'Annotatie'}
        className="rounded bg-amber-200/70 px-0.5 text-[#1e293b] cursor-help">
        {text.slice(r.start, r.end)}
      </mark>,
    )
    cursor = r.end
  })
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

// Mini-markdownweergave (##, ###, - lijst) met inline highlight-markering.
function CaseView({ text, marks }: { text: string; marks: Highlight[] }) {
  const lines = text.split('\n')
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = (key: string) => {
    if (!bullets.length) return
    const items = bullets
    out.push(
      <ul key={key} className="my-1.5 space-y-1">
        {items.map((b, i) => (
          <li key={i} className="flex gap-1.5 text-sm text-[#334155]"><span className="text-[#cbd5e1]">•</span><span>{renderWithMarks(b, marks)}</span></li>
        ))}
      </ul>,
    )
    bullets = []
  }
  lines.forEach((raw, i) => {
    const line = raw.trimEnd()
    if (line.startsWith('### ')) { flush(`u${i}`); out.push(<h3 key={i} className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-[#64748b]">{line.slice(4)}</h3>) }
    else if (line.startsWith('## ')) { flush(`u${i}`); out.push(<h2 key={i} className="mb-1 text-base font-semibold text-[#1e293b]">{line.slice(3)}</h2>) }
    else if (line.startsWith('- ')) { bullets.push(line.slice(2)) }
    else if (line.trim() === '') { flush(`u${i}`) }
    else { flush(`u${i}`); out.push(<p key={i} className="text-sm text-[#334155]">{renderWithMarks(line, marks)}</p>) }
  })
  flush('end')
  return <div>{out}</div>
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map(v => (
        <button key={String(v)} type="button" onClick={() => onChange(v)}
          className={`rounded-lg border px-5 py-1.5 text-sm font-medium transition-colors ${
            value === v ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683]'
          }`}>
          {v ? 'Ja' : 'Nee'}
        </button>
      ))}
    </div>
  )
}

interface Selection { text: string; contextBefore: string; contextAfter: string; top: number; left: number }

export function AnnotatieForm({ roundId, clientId, caseText, hasPdf, initial, initialHighlights }: Props) {
  const router = useRouter()
  const [f, setF] = useState<AnnotationFields>(initial)
  const [status, setStatus] = useState(initial.status)
  const [busy, setBusy]   = useState<'concept' | 'indienen' | 'training' | null>(null)
  const [pdfBusy, setPdfBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights)
  const [sel, setSel] = useState<Selection | null>(null)
  const [note, setNote] = useState('')
  const [hlBusy, setHlBusy] = useState(false)
  const caseRef = useRef<HTMLDivElement>(null)

  function upd<K extends keyof AnnotationFields>(k: K, v: AnnotationFields[K]) {
    setF(prev => ({ ...prev, [k]: v })); setError(''); setNotice('')
  }
  function toggleDomain(v: string) {
    upd('vervolg_domeinen', f.vervolg_domeinen.includes(v)
      ? f.vervolg_domeinen.filter(x => x !== v)
      : [...f.vervolg_domeinen, v])
  }

  // ── Tekstselectie in de casusweergave ────────────────────────────────────────
  function onCaseMouseUp() {
    const s = window.getSelection()
    if (!s || s.isCollapsed) { setSel(null); return }
    const text = s.toString().trim()
    if (text.length < 3) { setSel(null); return }
    const range = s.getRangeAt(0)
    if (!caseRef.current?.contains(range.commonAncestorContainer)) return
    const rect = range.getBoundingClientRect()
    const full = caseRef.current.textContent ?? ''
    const idx = full.indexOf(text)
    setSel({
      text,
      contextBefore: idx > 0 ? full.slice(Math.max(0, idx - 40), idx) : '',
      contextAfter:  idx >= 0 ? full.slice(idx + text.length, idx + text.length + 40) : '',
      top:  rect.bottom + 6,
      left: Math.max(8, rect.left),
    })
    setNote('')
  }

  async function saveHighlight() {
    if (!sel) return
    setHlBusy(true); setError('')
    const res = await fetch('/api/annotatie/highlight', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundId, clientId, selected_text: sel.text,
        context_before: sel.contextBefore, context_after: sel.contextAfter, note,
      }),
    })
    const j = await res.json().catch(() => ({}))
    setHlBusy(false)
    if (!res.ok || !j.highlight) { setError(j.error ?? 'Highlight opslaan mislukt.'); return }
    setHighlights(prev => [...prev, j.highlight])
    setSel(null); setNote('')
    window.getSelection()?.removeAllRanges()
  }

  async function deleteHighlight(id: string) {
    setHighlights(prev => prev.filter(h => h.id !== id))
    await fetch('/api/annotatie/highlight', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlightId: id }),
    }).catch(() => {})
  }

  async function openPdf() {
    setPdfBusy(true); setError('')
    try {
      const res = await fetch(`/api/annotatie/pdf?clientId=${clientId}`)
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.url) window.open(j.url, '_blank', 'noopener')
      else setError(j.error ?? 'PDF kon niet worden geopend.')
    } finally { setPdfBusy(false) }
  }

  // Sla de huidige velden op (concept of ingediend). Geeft true bij succes.
  async function persist(submit: boolean): Promise<boolean> {
    const res = await fetch('/api/annotatie/annotatie', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, clientId, ...f, submit }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setError(j.error ?? 'Opslaan mislukt.'); return false }
    return true
  }

  async function save(submit: boolean) {
    if (submit) {
      if (!f.algemeen_beeld.trim() || !f.advies.trim() || f.verbeterpotentieel == null) {
        setError('Vul minimaal het algemene beeld, je advies en het verbeterpotentieel in voordat je indient.')
        return
      }
    }
    setBusy(submit ? 'indienen' : 'concept'); setError(''); setNotice('')
    const ok = await persist(submit)
    setBusy(null)
    if (!ok) return
    if (submit) { router.push('/'); return }
    setStatus('concept')
    setNotice('Concept opgeslagen.')
  }

  // Sla eerst de huidige stand op en voeg de casus dan toe aan de trainingsmodule.
  async function uploadTraining() {
    setBusy('training'); setError(''); setNotice('')
    if (!await persist(false)) { setBusy(null); return }
    const res = await fetch('/api/annotatie/naar-training', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId, clientId }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(j.error ?? 'Uploaden mislukt.'); return }
    setStatus(prev => (prev === 'ingediend' ? prev : 'concept'))
    setNotice('Toegevoegd aan de trainingsmodule (concept). Controleer en indexeer het in de kennisbank.')
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* ── Casusweergave ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#1e293b]">Vragenlijst &amp; biomarkers</h2>
          {hasPdf && (
            <button onClick={openPdf} disabled={pdfBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc] disabled:opacity-50">
              {pdfBusy ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />} Open PDF <ExternalLink size={11} />
            </button>
          )}
        </div>
        <div className="border-b border-[#f1f5f9] bg-[#fffdf5] px-5 py-2 text-xs text-[#8a6d3b]">
          Selecteer een stuk tekst om er een annotatie bij te maken.
        </div>
        <div ref={caseRef} onMouseUp={onCaseMouseUp} className="max-h-[60vh] overflow-y-auto px-5 py-4 selection:bg-amber-200">
          <CaseView text={caseText} marks={highlights} />
        </div>

        {/* Highlight-lijst */}
        {highlights.length > 0 && (
          <div className="border-t border-[#e2e8f0] px-5 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
              <Highlighter size={13} /> Annotaties ({highlights.length})
            </p>
            <ul className="space-y-2">
              {highlights.map(h => (
                <li key={h.id} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs italic text-[#8a6d3b]">&ldquo;{h.selected_text}&rdquo;</p>
                      {h.note && <p className="mt-0.5 text-sm text-[#334155]">{h.note}</p>}
                    </div>
                    <button onClick={() => deleteHighlight(h.id)} className="shrink-0 text-[#cbd5e1] hover:text-red-500" title="Verwijderen">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Beoordeling ───────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3">
          <h2 className="text-sm font-semibold text-[#1e293b]">Jouw beoordeling</h2>
          {status === 'ingediend' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 size={11} /> Ingediend
            </span>
          )}
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Algemeen beeld */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b]">Algemeen beeld <span className="text-[#94a3b8] font-normal">(korte anamnese)</span></label>
            <textarea value={f.algemeen_beeld} onChange={e => upd('algemeen_beeld', e.target.value)} rows={4}
              className="mt-1.5 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y" />
          </div>

          {/* Bespreken in team */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Bespreken in medisch team?</label>
            <YesNo value={f.bespreken_team} onChange={v => upd('bespreken_team', v)} />
          </div>

          {/* Advies */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b]">Advies <span className="text-[#94a3b8] font-normal">(top 3)</span></label>
            <textarea value={f.advies} onChange={e => upd('advies', e.target.value)} rows={4} placeholder={'1. …\n2. …\n3. …'}
              className="mt-1.5 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y" />
          </div>

          {/* Verbeterpotentieel */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-2">Verwacht verbeterpotentieel</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8] w-12 text-right shrink-0">weinig</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 11 }, (_, n) => (
                  <button key={n} type="button" onClick={() => upd('verbeterpotentieel', n)}
                    className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
                      f.verbeterpotentieel === n ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683]'
                    }`}>{n}</button>
                ))}
              </div>
              <span className="text-xs text-[#94a3b8] w-10 shrink-0">veel</span>
            </div>
          </div>

          {/* Vervolg-domeinen */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-2">Op welk gebied ligt een vervolg? <span className="text-[#94a3b8] font-normal">(meerdere mogelijk)</span></label>
            <div className="flex flex-wrap gap-2">
              {FOLLOWUP_DOMAINS.map(d => {
                const on = f.vervolg_domeinen.includes(d.value)
                return (
                  <button key={d.value} type="button" onClick={() => toggleDomain(d.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on ? 'bg-[#17e4a1]/15 text-[#0d7a5f] border-[#17e4a1]' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#17e4a1]'
                    }`}>{d.label}</button>
                )
              })}
            </div>
          </div>

          {/* Wearables */}
          <div>
            <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Zijn metingen met wearables nuttig bij vervolg?</label>
            <YesNo value={f.wearables_nuttig} onChange={v => upd('wearables_nuttig', v)} />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {notice && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700">{notice}</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button onClick={() => save(false)} disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50">
              {busy === 'concept' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Concept opslaan
            </button>
            <button onClick={() => save(true)} disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] disabled:opacity-50">
              {busy === 'indienen' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Indienen
            </button>
          </div>

          <div className="border-t border-[#f1f5f9] pt-3">
            <button onClick={uploadTraining} disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-[#17e4a1] bg-[#17e4a1]/10 px-4 py-2 text-sm font-medium text-[#0d7a5f] hover:bg-[#17e4a1]/20 disabled:opacity-50">
              {busy === 'training' ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={15} />} Naar trainingsmodule
            </button>
            <p className="mt-1.5 text-xs text-[#94a3b8]">
              Voegt deze casus + jouw beoordeling gepseudonimiseerd als concept toe aan de kennisbank.
            </p>
          </div>
        </div>
      </div>

      {/* ── Selectie-popover ──────────────────────────────────────────────────── */}
      {sel && (
        <div className="fixed z-50 w-72 rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-lg"
          style={{ top: sel.top, left: sel.left }}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs italic text-[#8a6d3b] line-clamp-2">&ldquo;{sel.text}&rdquo;</p>
            <button onClick={() => { setSel(null); window.getSelection()?.removeAllRanges() }} className="shrink-0 text-[#cbd5e1] hover:text-[#64748b]">
              <X size={14} />
            </button>
          </div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} autoFocus
            placeholder="Wat valt je op bij dit stuk?"
            className="w-full rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-sm text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y" />
          <div className="mt-2 flex justify-end">
            <button onClick={saveHighlight} disabled={hlBusy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f1683] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1a1270] disabled:opacity-50">
              {hlBusy ? <Loader2 size={12} className="animate-spin" /> : <Highlighter size={12} />} Annotatie opslaan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
