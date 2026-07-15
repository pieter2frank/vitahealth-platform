'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, CheckCircle2, AlertTriangle } from 'lucide-react'

interface Option { id: string; label: string; meta: string }
interface Arts { userId: string; name: string }

export function RondeForm({ options, artsen }: { options: Option[]; artsen: Arts[] }) {
  const router = useRouter()
  const [title, setTitle]     = useState('')
  const [note, setNote]       = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [artsSel, setArtsSel]   = useState<Set<string>>(new Set())
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState('')

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setError(''); setDone('')
  }
  function toggleArts(id: string) {
    setArtsSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setError(''); setDone('')
  }

  async function submit() {
    if (!title.trim()) { setError('Geef de ronde een titel.'); return }
    if (selected.size === 0) { setError('Selecteer minstens één dossier.'); return }
    if (artsSel.size === 0) { setError('Selecteer minstens één arts.'); return }
    setBusy(true); setError(''); setDone('')
    const res = await fetch('/api/annotatie/rondes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), note: note.trim(), clientIds: [...selected], artsUserIds: [...artsSel] }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Aanmaken mislukt.'); return }
    setDone(`Ronde aangemaakt met ${j.casesCount} casus${j.casesCount === 1 ? '' : 'sen'}. ${j.mailed} arts${j.mailed === 1 ? '' : 'en'} gemaild.`)
    setTitle(''); setNote(''); setSelected(new Set()); setArtsSel(new Set())
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Titel van de ronde</label>
            <input value={title} onChange={e => { setTitle(e.target.value); setError('') }} placeholder="Bijv. Annotatieronde juli"
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Notitie <span className="text-[#cbd5e1]">(optioneel)</span></label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Korte toelichting voor de artsen"
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]" />
          </div>
        </div>

        {/* Artsen toewijzen */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-[#64748b]">Artsen die annoteren ({artsen.length})</label>
            <span className="text-xs text-[#94a3b8]">{artsSel.size} geselecteerd</span>
          </div>
          {artsen.length === 0 ? (
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3 text-sm text-[#94a3b8]">Geen artsen gevonden.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {artsen.map(a => {
                const on = artsSel.has(a.userId)
                return (
                  <button key={a.userId} type="button" onClick={() => toggleArts(a.userId)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      on ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683]'
                    }`}>{a.name}</button>
                )
              })}
            </div>
          )}
        </div>

        {/* Dossiers */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-medium text-[#64748b]">Geschikte dossiers ({options.length})</label>
            <span className="text-xs text-[#94a3b8]">{selected.size} geselecteerd</span>
          </div>
          {options.length === 0 ? (
            <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-4 text-sm text-[#94a3b8]">
              Er zijn nog geen dossiers met zowel een vragenlijst als een biomarkeruitslag.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
              {options.map(o => (
                <label key={o.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-[#f8fafc] cursor-pointer">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)}
                    className="mt-0.5 h-4 w-4 accent-[#1f1683]" />
                  <span className="min-w-0">
                    <span className="block text-sm text-[#1e293b]">{o.label}</span>
                    {o.meta && <span className="block text-xs text-[#94a3b8]">{o.meta}</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-700">{done}</p>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Ronde aanmaken &amp; artsen mailen
          </button>
        </div>
      </div>
    </div>
  )
}
