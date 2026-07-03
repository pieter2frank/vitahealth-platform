'use client'
import { useState } from 'react'
import Link from 'next/link'
import { GraduationCap, X, Loader2, AlertTriangle, CheckCircle2, Upload, ShieldCheck } from 'lucide-react'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'
import { KNOWLEDGE_DOMAINS } from '@/lib/knowledge-domains'

interface Props { clientId: string }

const inputCls =
  'w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]'

export function TrainingDocModal({ clientId }: Props) {
  const { role } = useUser()
  const [open, setOpen] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [title, setTitle]       = useState('')
  const [domain, setDomain]     = useState('algemeen')
  const [caseText, setCaseText] = useState('')
  const [advice, setAdvice]     = useState('')
  const [activate, setActivate] = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState<{ id: string; indexed: boolean; chunks: number; indexError: string | null } | null>(null)

  if (!canSeeResults(role)) return null

  async function handleOpen() {
    setOpen(true); setLoading(true); setError(''); setDone(null); setAdvice('')
    const res = await fetch('/api/knowledge/case-text', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }),
    })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'Opbouwen mislukt.'); return }
    setTitle(data.title ?? 'Casus'); setCaseText(data.text ?? '')
  }

  function close() { setOpen(false); setError(''); setDone(null) }

  async function handleUpload() {
    setError('')
    if (!title.trim()) { setError('Titel is verplicht.'); return }
    if (advice.trim().length < 10) { setError('Vul eerst het advies van de arts in.'); return }
    setSaving(true)
    const body = `${caseText.trim()}\n\n### Advies van de arts\n\n${advice.trim()}`
    const res = await fetch('/api/knowledge/from-case', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, title, domain, body, activate }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Uploaden mislukt.'); return }
    setDone({ id: data.id, indexed: data.indexed, chunks: data.chunks, indexError: data.indexError })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
      >
        <GraduationCap size={15} />
        Maak trainingsdocument
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8" onClick={close}>
          <div className="my-auto w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#1e293b]">
                  <GraduationCap size={17} className="text-[#1f1683]" />
                  Trainingsdocument uit casus
                </h2>
                <p className="mt-0.5 text-xs text-[#64748b]">Gepseudonimiseerd — zonder naam, adres of geboortejaar.</p>
              </div>
              <button onClick={close} className="ml-4 shrink-0 text-[#94a3b8] hover:text-[#64748b]"><X size={18} /></button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-[#94a3b8]">
                <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Casus samenstellen…</span>
              </div>
            ) : done ? (
              <div className="px-6 py-10 text-center space-y-3">
                <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
                <p className="text-sm font-medium text-[#1e293b]">Trainingsdocument aangemaakt.</p>
                <p className="text-xs text-[#64748b]">
                  {done.indexed
                    ? `Geïndexeerd in ${done.chunks} fragment${done.chunks === 1 ? '' : 'en'} en klaar voor gebruik.`
                    : (done.indexError ?? 'Nog niet geïndexeerd.')}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Link href={`/kennisbank/${done.id}`} className="text-sm font-medium text-[#1f1683] hover:underline">
                    Openen in kennisbank →
                  </Link>
                  <button onClick={close} className="text-sm text-[#64748b] hover:text-[#1e293b]">Sluiten</button>
                </div>
              </div>
            ) : (
              <div className="max-h-[74vh] overflow-auto px-6 py-5 space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-[#fffdf5] px-3 py-2.5">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-500" />
                  <p className="text-xs text-[#8a6d3b]">
                    Controleer het document op herleidbare gegevens (bijv. vrije-tekstantwoorden) vóór je het uploadt.
                    Naam, adres en geboortejaar zijn automatisch weggelaten; de leeftijd is wél opgenomen.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="block text-sm font-medium text-[#1e293b]">Titel</label>
                    <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#1e293b]">Domein</label>
                    <select value={domain} onChange={e => setDomain(e.target.value)} className={inputCls}>
                      {KNOWLEDGE_DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#1e293b]">Casusdocument <span className="font-normal text-[#94a3b8]">(bewerkbaar)</span></label>
                  <textarea value={caseText} onChange={e => setCaseText(e.target.value)} rows={14}
                    className={`${inputCls} resize-y leading-relaxed font-mono text-xs`} />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[#1e293b]">Advies van de arts <span className="text-red-500">*</span></label>
                  <textarea value={advice} onChange={e => setAdvice(e.target.value)} rows={7}
                    placeholder="Wat is in dit concrete geval het advies? Beschrijf leefstijl-/begeleidingsadvies zo concreet mogelijk — dit is de kern van de trainingswaarde."
                    className={`${inputCls} resize-y leading-relaxed`} />
                </div>

                <label className="flex items-center gap-2 text-sm text-[#334155]">
                  <input type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)}
                    className="h-4 w-4 rounded border-[#cbd5e1] text-[#1f1683] focus:ring-[#1f1683]/30" />
                  Direct op &lsquo;Actief&rsquo; zetten (meteen bruikbaar voor advies)
                </label>

                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                    <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            {!loading && !done && (
              <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3">
                <button onClick={close} className="text-xs text-[#64748b] hover:text-[#1e293b]">Annuleren</button>
                <button onClick={handleUpload} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {saving ? 'Uploaden…' : 'Upload naar trainingsmodule'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
