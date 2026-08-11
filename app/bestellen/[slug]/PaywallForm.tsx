'use client'
import { useState } from 'react'
import { formatEuro, type PriceBreakdown } from '@/lib/payments/pricing'
import { Loader2, ShieldCheck, Tag, AlertTriangle, CheckCircle2, Stethoscope, Lock } from 'lucide-react'

interface Pkg { slug: string; name: string; description: string | null; includesConsult: boolean; vatRate: number }

export function PaywallForm({ pkg, initialPrice, initialCode, initialEmail, mollieReady }: {
  pkg: Pkg
  initialPrice: PriceBreakdown
  initialCode: string
  initialEmail: string
  mollieReady: boolean
}) {
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode]   = useState(initialCode)
  const [price, setPrice] = useState(initialPrice)
  const [applied, setApplied] = useState(Boolean(initialCode))
  const [codeMsg, setCodeMsg] = useState('')
  const [applying, setApplying] = useState(false)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  const free = price.amount_cents === 0

  async function applyCode() {
    setApplying(true); setError(''); setCodeMsg('')
    const res = await fetch('/api/payments/discount', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: pkg.slug, code }),
    })
    const j = await res.json().catch(() => ({}))
    setApplying(false)
    if (!res.ok) { setError(j.error ?? 'Controle mislukt.'); return }
    setPrice(j.price)
    if (j.codeApplied) { setApplied(true); setCodeMsg('Kortingscode toegepast.') }
    else { setApplied(false); setCodeMsg(j.codeError ?? 'Kortingscode niet geldig.') }
  }

  async function pay() {
    if (!email.trim() || !email.includes('@')) { setError('Voer een geldig e-mailadres in.'); return }
    setPaying(true); setError('')
    const res = await fetch('/api/payments/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: pkg.slug, email: email.trim(), code: applied ? code : '' }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setPaying(false); setError(j.error ?? 'Er ging iets mis.'); return }
    // Mollie-checkout of (bij €0) direct naar de afrondpagina.
    window.location.href = j.checkoutUrl ?? j.redirectUrl
  }

  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between ${strong ? 'text-[#1e293b] font-semibold' : 'text-[#64748b]'}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  )

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-7 shadow-sm">
      <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#1f1683]">
        <ShieldCheck size={12} /> Stap 1 van 5 · Betaling
      </div>
      <h1 className="mt-3 text-xl font-bold text-[#1e293b]">{pkg.name}</h1>
      {pkg.description && <p className="mt-1 text-sm text-[#64748b]">{pkg.description}</p>}
      {pkg.includesConsult && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#0d7a5f]">
          <Stethoscope size={13} /> Inclusief consult met een leefstijlarts
        </p>
      )}

      {/* Prijsopbouw */}
      <div className="mt-5 space-y-1.5 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-4 text-sm">
        {row('Pakketprijs', formatEuro(price.gross_cents))}
        {price.discount_cents > 0 && row('Korting', '− ' + formatEuro(price.discount_cents))}
        <div className="my-1 border-t border-[#e2e8f0]" />
        {row('Te betalen (incl. btw)', formatEuro(price.amount_cents), true)}
        <p className="pt-0.5 text-xs text-[#94a3b8]">waarvan {Number(price.vat_rate)}% btw: {formatEuro(price.vat_cents)}</p>
      </div>

      {/* E-mail */}
      <label className="mt-5 block text-sm font-medium text-[#1e293b]">E-mailadres</label>
      <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
        placeholder="naam@voorbeeld.nl" autoComplete="email"
        className="mt-1.5 w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]" />
      <p className="mt-1 text-xs text-[#94a3b8]">Hierop ontvang je de factuur en de link om de intake af te ronden.</p>

      {/* Kortingscode */}
      <label className="mt-4 block text-sm font-medium text-[#1e293b]">Kortingscode <span className="font-normal text-[#94a3b8]">(optioneel)</span></label>
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setApplied(false); setCodeMsg('') }}
            placeholder="CODE"
            className="w-full rounded-lg border border-[#e2e8f0] py-2.5 pl-9 pr-3 text-sm uppercase tracking-wide text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]" />
        </div>
        <button onClick={applyCode} disabled={applying || !code.trim()}
          className="rounded-lg border border-[#e2e8f0] px-4 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50">
          {applying ? <Loader2 size={14} className="animate-spin" /> : 'Toepassen'}
        </button>
      </div>
      {codeMsg && (
        <p className={`mt-1.5 flex items-center gap-1 text-xs ${applied ? 'text-emerald-600' : 'text-amber-600'}`}>
          {applied ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {codeMsg}
        </p>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button onClick={pay} disabled={paying || (!free && !mollieReady)}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1683] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1270] disabled:opacity-50">
        {paying ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
        {free ? 'Gratis starten' : `Betaal ${formatEuro(price.amount_cents)}`}
      </button>

      {!free && !mollieReady && (
        <p className="mt-2 text-center text-xs text-amber-600">Betalen is nog niet geconfigureerd (testomgeving).</p>
      )}
      <p className="mt-3 text-center text-xs text-[#94a3b8]">Veilig betalen via Mollie · daarna rond je de intake af.</p>
    </div>
  )
}
