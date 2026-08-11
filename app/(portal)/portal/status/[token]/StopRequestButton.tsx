'use client'
import { useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

// Zelf-service stopverzoek vanuit het statusoverzicht. Verstuurt een verzoek;
// een medewerker bevestigt en verwerkt de terugbetaling (geen directe restitutie).
export function StopRequestButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit() {
    setState('sending')
    try {
      const res = await fetch('/api/portal/stop-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, reason }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  if (state === 'done') {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Stopverzoek ontvangen</p>
          <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
            We hebben je verzoek om te stoppen ontvangen. Een medewerker neemt het in behandeling en verwerkt de terugbetaling. Je ontvangt hierover bericht per e-mail.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-5">
      {!open ? (
        <div className="text-center">
          <p className="text-sm text-[#64748b]">Wil je stoppen met dit traject?</p>
          <button
            onClick={() => setOpen(true)}
            className="mt-2 text-sm font-medium text-[#64748b] underline underline-offset-2 hover:text-red-600"
          >
            Stopzetten en terugbetaling aanvragen
          </button>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-[#1e293b]">Traject stopzetten</p>
          <p className="text-xs text-[#64748b] mt-1 leading-relaxed">
            Na bevestiging door een medewerker wordt je betaling volledig teruggestort en ontvang je een creditfactuur. Je aanmelding wordt daarmee beëindigd.
          </p>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reden (optioneel)"
            rows={2}
            className="mt-3 w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#1f1683] focus:outline-none"
          />
          {state === 'error' && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <XCircle size={13} /> Er ging iets mis. Probeer het later opnieuw of neem contact op met de helpdesk.
            </p>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              disabled={state === 'sending'}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]"
            >
              Annuleren
            </button>
            <button
              onClick={submit}
              disabled={state === 'sending'}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {state === 'sending' && <Loader2 size={14} className="animate-spin" />}
              Verzoek indienen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
