'use client'
import { useState } from 'react'
import { Loader2, Save, Check, AlertTriangle } from 'lucide-react'

export function TeamReviewForm({ clientId, initialBespreken, initialVraag }: {
  clientId: string
  initialBespreken: boolean
  initialVraag: string
}) {
  const [bespreken, setBespreken] = useState(initialBespreken)
  const [vraag, setVraag] = useState(initialVraag)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const dirty = bespreken !== initialBespreken || vraag !== initialVraag

  async function save() {
    setBusy(true); setError(''); setSaved(false)
    const res = await fetch(`/api/clients/${clientId}/team-review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bespreken_team: bespreken, team_vraag: vraag }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Opslaan mislukt.'); return }
    setSaved(true)
  }

  return (
    <div className="space-y-4 px-5 py-4">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input type="checkbox" checked={bespreken} onChange={e => { setBespreken(e.target.checked); setSaved(false) }}
          className="h-4 w-4 accent-[#1f1683]" />
        <span className="text-sm text-[#1e293b]">Bespreken in medisch team</span>
      </label>

      <div>
        <label className="block text-sm font-medium text-[#1e293b]">
          Vraag vanuit beoordelaar aan medisch team <span className="font-normal text-[#94a3b8]">(optioneel)</span>
        </label>
        <textarea value={vraag} onChange={e => { setVraag(e.target.value); setSaved(false) }} rows={3}
          placeholder="Wat wil je aan het medisch team voorleggen over dit dossier?"
          className="mt-1.5 w-full resize-y rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#cbd5e1] focus:border-[#1f1683] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30" />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Opslaan
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0d7a5f]">
            <Check size={13} /> Opgeslagen
          </span>
        )}
      </div>
    </div>
  )
}
