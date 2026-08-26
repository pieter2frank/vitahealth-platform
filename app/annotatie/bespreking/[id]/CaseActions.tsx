'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, Check, CheckCircle2, RotateCcw, FileText, ExternalLink, AlertTriangle, NotebookPen } from 'lucide-react'

// Twee gedaanten:
//  - compact (in de casuskop): PDF-knop + besproken-knop
//  - volledig (naast de arts-input): notitieveld met opslaan
export function CaseActions({ meetingId, clientId, initialNotes, initialDiscussed, hasPdf, compact }: {
  meetingId: string
  clientId: string
  initialNotes?: string
  initialDiscussed: boolean
  hasPdf: boolean
  compact?: boolean
}) {
  const router = useRouter()
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [discussed, setDiscussed] = useState(initialDiscussed)
  const [busy, setBusy] = useState<'' | 'notes' | 'discussed' | 'pdf'>('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/annotatie/bespreking/${meetingId}/case`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, ...body }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error ?? 'Opslaan mislukt.')
  }

  async function saveNotes() {
    setBusy('notes'); setError(''); setSaved(false)
    try { await patch({ notes }); setSaved(true); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Opslaan mislukt.') }
    finally { setBusy('') }
  }

  async function toggleDiscussed() {
    setBusy('discussed'); setError('')
    try { await patch({ discussed: !discussed }); setDiscussed(!discussed); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Opslaan mislukt.') }
    finally { setBusy('') }
  }

  async function openPdf() {
    setBusy('pdf'); setError('')
    try {
      const res = await fetch(`/api/annotatie/pdf?clientId=${clientId}`)
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.url) window.open(j.url, '_blank', 'noopener')
      else setError(j.error ?? 'PDF kon niet worden geopend.')
    } finally { setBusy('') }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        {hasPdf && (
          <button onClick={openPdf} disabled={busy === 'pdf'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc] disabled:opacity-50">
            {busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            Biomarker-PDF <ExternalLink size={11} />
          </button>
        )}
        <button onClick={toggleDiscussed} disabled={busy === 'discussed'}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
            discussed
              ? 'border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]'
              : 'bg-[#17e4a1] text-[#0b3f31] hover:bg-[#12cb8e]'
          }`}>
          {busy === 'discussed' ? <Loader2 size={12} className="animate-spin" /> : discussed ? <RotateCcw size={12} /> : <CheckCircle2 size={12} />}
          {discussed ? 'Toch niet besproken' : 'Markeer als besproken'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="border-b border-[#e2e8f0] px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1e293b]">
          <NotebookPen size={13} className="text-[#1f1683]" /> Besproken in het expertteam
        </h3>
      </div>
      <div className="space-y-3 px-4 py-3">
        <textarea value={notes} onChange={e => { setNotes(e.target.value); setSaved(false) }} rows={10}
          placeholder="Conclusies, afspraken en actiepunten uit de bespreking…"
          className="w-full resize-y rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#cbd5e1] focus:border-[#1f1683] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30" />
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button onClick={saveNotes} disabled={busy === 'notes'}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
            {busy === 'notes' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Notities opslaan
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0d7a5f]">
              <Check size={13} /> Opgeslagen
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
