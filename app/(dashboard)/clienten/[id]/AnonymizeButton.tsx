'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, EraserIcon, XCircle } from 'lucide-react'

// Dossier anonimiseren (retentiebeleid): verwijdert de kluisrij + wist de
// kopergegevens op bestellingen. Alleen zichtbaar voor admin, alleen mogelijk
// bij een afgerond/beëindigd traject (de server dwingt dat ook af).
export function AnonymizeButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/clients/${clientId}/anonymize`, { method: 'POST' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Anonimiseren mislukt.'); setBusy(false); return }
      setOpen(false)
      router.refresh()
    } catch { setError('Anonimiseren mislukt.'); setBusy(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#fff7ed] hover:text-amber-700 transition-colors"
      >
        <EraserIcon size={15} />
        Dossier anonimiseren
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#1e293b]">Dossier anonimiseren</h2>
            <p className="mt-2 text-sm text-[#64748b] leading-relaxed">
              De identiteit van <strong>{clientName}</strong> (naam, adres, e-mail, telefoon,
              geboortedatum) wordt <strong>definitief verwijderd</strong> uit de kluis, en de
              kopergegevens op bestellingen worden gewist. Het medische dossier blijft naamloos
              bestaan voor statistiek; de formele factuur-PDF's blijven bewaard (fiscale
              bewaarplicht). <strong>Dit kan niet ongedaan worden gemaakt.</strong>
            </p>
            {error && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setOpen(false)} disabled={busy} className="rounded-lg px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">
                Annuleren
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {busy && <Loader2 size={14} className="animate-spin" />}
                Definitief anonimiseren
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
