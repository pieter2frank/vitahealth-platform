'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, RotateCcw, AlertTriangle } from 'lucide-react'

// AI-voorbereiding per besprekingscasus: kernvraag + kernpunten +
// discussiepunten, gegenereerd uit het pseudonieme casusdocument en gecachet.
export function AiPrep({ meetingId, clientId, initial, generatedAt }: {
  meetingId: string
  clientId: string
  initial: string | null
  generatedAt: string | null
}) {
  const router = useRouter()
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setBusy(true); setError('')
    const res = await fetch(`/api/annotatie/bespreking/${meetingId}/prep`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Genereren mislukt.'); return }
    setText(j.text)
    router.refresh()
  }

  return (
    <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1e293b]">
          <Sparkles size={13} className="text-[#17e4a1]" /> AI-voorbereiding
          {generatedAt && text && (
            <span className="font-normal text-[#94a3b8]">
              · {new Date(generatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </h3>
        <button onClick={generate} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc] disabled:opacity-50">
          {busy ? <Loader2 size={12} className="animate-spin" /> : text ? <RotateCcw size={12} /> : <Sparkles size={12} />}
          {busy ? 'Bezig…' : text ? 'Vernieuw' : 'Genereer voorbereiding'}
        </button>
      </div>
      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      {text
        ? <p className="whitespace-pre-wrap px-4 py-3 text-[12.5px] leading-relaxed text-[#334155]">{text}</p>
        : !busy && <p className="px-4 py-3 text-xs text-[#94a3b8]">Nog geen voorbereiding gegenereerd — de samenvatting gebruikt uitsluitend het pseudonieme casusdocument en de arts-input.</p>}
    </div>
  )
}
