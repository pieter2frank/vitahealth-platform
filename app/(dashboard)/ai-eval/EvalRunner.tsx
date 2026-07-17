'use client'
import { useState } from 'react'
import { Loader2, Play, AlertTriangle, Stethoscope, Sparkles, Timer } from 'lucide-react'

interface Option { id: string; label: string }
interface Output { text: string; ms: number; error?: string }
interface Result {
  clientId:   string
  label:      string
  chunksUsed?: number
  artsAdvies?: string | null
  artsBeeld?:  string | null
  outputs?:    Record<string, Output>
  error?:      string
}

const MAX = 3

export function EvalRunner({ options, currentName, claudeName }: {
  options: Option[]
  currentName: string
  claudeName: string | null
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [variants, setVariants] = useState<{ key: string; name: string }[]>([])
  const [results, setResults] = useState<Result[]>([])

  function toggle(id: string) {
    setSel(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else if (n.size < MAX) n.add(id)
      return n
    })
    setError('')
  }

  async function run() {
    if (sel.size === 0) { setError('Selecteer minstens één casus.'); return }
    setBusy(true); setError(''); setResults([])
    const res = await fetch('/api/ai-eval/run', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientIds: [...sel] }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(j.error ?? 'Uitvoeren mislukt.'); return }
    setVariants(j.variants ?? [])
    setResults(j.results ?? [])
  }

  return (
    <div className="space-y-5">
      {/* Modellen + AVG-waarschuwing */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748b]">Modellen in deze vergelijking</p>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-3 py-1 text-xs font-medium text-[#1f1683]">
            {currentName} <span className="font-normal text-[#94a3b8]">· huidig</span>
          </span>
          {claudeName ? (
            <span className="rounded-full border border-[#17e4a1] bg-[#17e4a1]/15 px-3 py-1 text-xs font-medium text-[#0d7a5f]">
              {claudeName}
            </span>
          ) : (
            <span className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1 text-xs text-[#94a3b8]">
              Claude niet geconfigureerd — zet ANTHROPIC_API_KEY om te vergelijken
            </span>
          )}
        </div>

        {claudeName && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-800">
              <strong>AVG:</strong> de casustekst is gepseudonimiseerd (geen naam/adres, wél leeftijd en
              gezondheidsdata) maar blijft een bijzonder persoonsgegeven. Gebruik dit alleen als de
              verwerkersovereenkomst én de EU-dataroute met Anthropic zijn vastgelegd.
            </p>
          </div>
        )}
      </div>

      {/* Casusselectie */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#1e293b]">Casussen met een ingediend artsadvies ({options.length})</h2>
            <p className="text-xs text-[#94a3b8]">Max. {MAX} per run — twee modellen per casus kost tijd.</p>
          </div>
          <button onClick={run} disabled={busy || sel.size === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {busy ? 'Bezig…' : `Vergelijk (${sel.size})`}
          </button>
        </div>

        {options.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#94a3b8]">
            Nog geen ingediende annotaties met een advies. Laat artsen eerst casussen annoteren —
            die adviezen zijn het ijkpunt van deze eval.
          </p>
        ) : (
          <div className="max-h-64 divide-y divide-[#f1f5f9] overflow-y-auto">
            {options.map(o => {
              const on = sel.has(o.id)
              const full = !on && sel.size >= MAX
              return (
                <label key={o.id} className={`flex items-center gap-2.5 px-5 py-2.5 ${full ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:bg-[#f8fafc]'}`}>
                  <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[#1f1683]" />
                  <span className="text-sm text-[#1e293b]">{o.label}</span>
                </label>
              )
            })}
          </div>
        )}

        {error && (
          <div className="mx-5 mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* Resultaten */}
      {results.map(r => (
        <div key={r.clientId} className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3">
            <h3 className="text-sm font-semibold text-[#1e293b]">{r.label}</h3>
            {r.chunksUsed != null && (
              <span className="text-xs text-[#94a3b8]">{r.chunksUsed} kennisbron{r.chunksUsed === 1 ? '' : 'nen'} · identieke context</span>
            )}
          </div>

          {r.error ? (
            <p className="px-5 py-4 text-sm text-red-600">{r.error}</p>
          ) : (
            <div className="grid gap-4 p-5 lg:grid-cols-3">
              {/* IJkpunt: de arts */}
              <div className="rounded-xl border-2 border-[#c7d7fd] bg-[#f8faff] p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[#1f1683]">
                  <Stethoscope size={13} /> Advies van de arts <span className="font-normal text-[#94a3b8]">· ijkpunt</span>
                </p>
                {r.artsBeeld && <p className="mb-2 text-xs italic text-[#64748b]">{r.artsBeeld}</p>}
                <p className="whitespace-pre-wrap text-[13px] text-[#334155]">{r.artsAdvies ?? '—'}</p>
              </div>

              {/* Modellen */}
              {variants.map(v => {
                const o = r.outputs?.[v.key]
                return (
                  <div key={v.key} className="rounded-xl border border-[#e2e8f0] p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
                        <Sparkles size={13} className="text-[#17e4a1]" /> {v.name}
                      </p>
                      {o && !o.error && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-[#94a3b8]">
                          <Timer size={10} /> {(o.ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                    {o?.error
                      ? <p className="text-xs text-red-600">{o.error}</p>
                      : <p className="whitespace-pre-wrap text-[13px] text-[#334155]">{o?.text || '—'}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
