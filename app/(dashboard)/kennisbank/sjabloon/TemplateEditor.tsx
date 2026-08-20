'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save, RotateCcw, AlertTriangle, Check, Info } from 'lucide-react'

export function TemplateEditor({ current, isDefault, defaultTemplate }: {
  current: string
  isDefault: boolean
  defaultTemplate: string
}) {
  const router = useRouter()
  const [text, setText] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    setBusy(true); setError(''); setSaved(false)
    const res = await fetch('/api/advice-template', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: text }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Opslaan mislukt.'); return }
    setSaved(true)
    router.refresh()
  }

  async function resetDefault() {
    if (!confirm('Terug naar het standaardsjabloon uit de code?')) return
    setBusy(true); setError(''); setSaved(false)
    const res = await fetch('/api/advice-template', { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { setError('Herstellen mislukt.'); return }
    setText(defaultTemplate)
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-[#c7d7fd] bg-[#eef4ff] px-3 py-2.5">
        <Info size={14} className="mt-0.5 shrink-0 text-[#1f1683]" />
        <div className="text-xs text-[#1e293b]">
          <p>Tips voor een goed sjabloon:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[#475569]">
            <li>Kopjes in HOOFDLETTERS; geen markdown-tekens (#, **) — de tekst wordt plat getoond.</li>
            <li>Zet tussen haakjes per sectie wat er moet komen; het model vult dat in.</li>
            <li>Houd de driedeling aandachtspunten vast — de top 3 wordt door het platform bepaald.</li>
            <li>Test elke wijziging direct met een AI-eval-run: de rubric toetst tegen dít sjabloon.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">
            Sjabloon {isDefault ? '· standaard (uit de code)' : '· aangepast'}
          </span>
          <span className="text-[11px] text-[#94a3b8]">{text.length} / 6000 tekens</span>
        </div>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setSaved(false) }}
          rows={22}
          spellCheck={false}
          className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-[#1e293b] focus:border-[#1f1683] focus:outline-none"
        />

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button onClick={save} disabled={busy || !text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Opslaan
          </button>
          <button onClick={resetDefault} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#1e293b] transition-colors hover:bg-[#f8fafc] disabled:opacity-50">
            <RotateCcw size={14} />
            Herstel standaard
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0d7a5f]">
              <Check size={13} /> Opgeslagen — geldt direct voor nieuwe adviezen
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
