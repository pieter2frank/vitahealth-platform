'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'

type Status = 'laden' | 'paid' | 'open' | 'failed' | 'expired' | 'canceled' | 'error'

export function AfrondenClient() {
  const params = useSearchParams()
  const orderId = params.get('order') ?? ''
  const [status, setStatus] = useState<Status>('laden')
  const [intakeUrl, setIntakeUrl] = useState<string | null>(null)
  const [tries, setTries] = useState(0)

  const check = useCallback(async () => {
    if (!orderId) { setStatus('error'); return }
    try {
      const res = await fetch(`/api/payments/status?order=${orderId}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setStatus('error'); return }
      setIntakeUrl(j.intakeUrl ?? null)
      setStatus(j.status as Status)
    } catch { setStatus('error') }
  }, [orderId])

  // Poll zolang de betaling nog 'open' is (redirect kan vóór de webhook komen).
  useEffect(() => { check() }, [check])
  useEffect(() => {
    if (status !== 'open' && status !== 'laden') return
    if (tries >= 15) return
    const t = setTimeout(() => { setTries(n => n + 1); check() }, 2000)
    return () => clearTimeout(t)
  }, [status, tries, check])

  const card = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#f8fafc]">{icon}</div>
      <h1 className="text-lg font-semibold text-[#1e293b]">{title}</h1>
      <div className="mt-1.5 text-sm text-[#64748b]">{body}</div>
    </div>
  )

  if (status === 'paid') {
    return card(
      <CheckCircle2 size={26} className="text-emerald-500" />,
      'Betaling geslaagd',
      <>
        <p>Je betaling is ontvangen — je ontvangt een bevestiging per e-mail. Rond nu je aanmelding af.</p>
        {intakeUrl ? (
          <a href={intakeUrl} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1a1270]">
            Ga naar de intake <ArrowRight size={15} />
          </a>
        ) : (
          <p className="mt-3 text-xs text-[#94a3b8]">De intakelink wordt klaargezet — check je e-mail als hij hier niet verschijnt.</p>
        )}
      </>,
    )
  }

  if (status === 'open' || status === 'laden') {
    return card(
      <Loader2 size={24} className="animate-spin text-[#1f1683]" />,
      'Betaling verwerken…',
      <p>Even geduld, we bevestigen je betaling. Dit duurt meestal enkele seconden.</p>,
    )
  }

  if (status === 'failed' || status === 'expired' || status === 'canceled') {
    return card(
      <XCircle size={26} className="text-red-500" />,
      'Betaling niet voltooid',
      <>
        <p>De betaling is {status === 'canceled' ? 'geannuleerd' : status === 'expired' ? 'verlopen' : 'mislukt'}. Er is niets afgeschreven.</p>
        <button onClick={() => history.back()} className="mt-4 rounded-lg border border-[#e2e8f0] px-5 py-2.5 text-sm font-medium text-[#1f1683] hover:bg-[#f8fafc]">
          Opnieuw proberen
        </button>
      </>,
    )
  }

  return card(
    <XCircle size={26} className="text-[#94a3b8]" />,
    'Bestelling niet gevonden',
    <p>We konden deze bestelling niet terugvinden. Neem contact op met de helpdesk als je toch hebt betaald.</p>,
  )
}
