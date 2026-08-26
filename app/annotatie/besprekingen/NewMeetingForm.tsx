'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, CalendarPlus, AlertTriangle, Flag } from 'lucide-react'

export interface Candidate {
  clientId: string
  label: string
  name: string | null
  flagged: boolean // gemarkeerd als "bespreken in team" (dossier of annotatie)
}

export function NewMeetingForm({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set(candidates.filter(c => c.flagged).map(c => c.clientId)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function toggle(id: string) {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  async function save() {
    setBusy(true); setError('')
    const res = await fetch('/api/annotatie/bespreking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, meetingDate: date, clientIds: [...sel] }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Aanmaken mislukt.'); return }
    setOpen(false); setTitle(''); setDate('')
    router.refresh()
  }

  return (
    <div>
      <div className="flex justify-end">
        <button onClick={() => setOpen(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270]">
          {open ? <X size={15} /> : <Plus size={15} />}
          {open ? 'Annuleren' : 'Nieuwe bespreking'}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#64748b]">Titel</span>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="bijv. MDO september"
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:border-[#1f1683] focus:outline-none" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[#64748b]">Datum bespreking</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:border-[#1f1683] focus:outline-none" />
            </label>
          </div>

          <div>
            <span className="mb-1 block text-xs font-medium text-[#64748b]">
              Dossiers ({sel.size} gekozen) — dossiers met markering “bespreken in team” staan bovenaan en zijn voorgeselecteerd
            </span>
            <div className="max-h-64 divide-y divide-[#f1f5f9] overflow-y-auto rounded-lg border border-[#e2e8f0]">
              {candidates.length === 0 && <p className="px-4 py-6 text-center text-sm text-[#94a3b8]">Geen dossiers met uitslag of annotatie gevonden.</p>}
              {candidates.map(c => (
                <label key={c.clientId} className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 hover:bg-[#f8fafc]">
                  <input type="checkbox" checked={sel.has(c.clientId)} onChange={() => toggle(c.clientId)} className="h-4 w-4 accent-[#1f1683]" />
                  <span className="text-sm text-[#1e293b]">{c.label}</span>
                  {c.name && <span className="text-sm text-[#64748b]">· {c.name}</span>}
                  {c.flagged && (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Flag size={9} /> bespreken in team
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button onClick={save} disabled={busy || !title.trim() || !date || sel.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CalendarPlus size={14} />}
            Bespreking aanmaken
          </button>
        </div>
      )}
    </div>
  )
}
