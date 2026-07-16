'use client'
import { useState } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  clientId: string
  clientEmail: string | null
  enrollmentStatus: string
}

// Intake nog niet af → intake-herinnering; kit verstuurd maar nog niet retour →
// herinnering om de kit terug te sturen. De route kiest de juiste e-mail op basis
// van dezelfde status.
const REMINDER_STATUSES = ['aangemeld', 'toestemming_gegeven', 'kit_opgestuurd']

export function ReminderButton({ clientId, clientEmail, enrollmentStatus }: Props) {
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  if (!clientEmail || !REMINDER_STATUSES.includes(enrollmentStatus)) return null

  const isKit = enrollmentStatus === 'kit_opgestuurd'
  const label = isKit ? 'Herinner aan retour' : 'Reminder versturen'
  const hint  = isKit
    ? 'Stuur een herinnering om de testkit terug te sturen'
    : 'Stuur een herinnering om de intake af te ronden'

  async function handleSend() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/email/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Verzenden mislukt.')
      } else {
        setSent(true)
      }
    } catch {
      setError('Netwerkfout — probeer opnieuw.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSend}
        disabled={sending || sent}
        title={hint}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
          sent
            ? 'border-green-200 bg-green-50 text-green-700'
            : 'border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc]'
        }`}
      >
        {sending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : sent ? (
          <CheckCircle2 size={14} className="text-green-600" />
        ) : (
          <Bell size={14} />
        )}
        {sent ? 'Reminder verstuurd' : label}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  )
}
