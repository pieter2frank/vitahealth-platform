'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

const INPUT = 'w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683]'

const ROLES = [
  { value: 'medewerker',    label: 'Medewerker' },
  { value: 'arts',          label: 'Arts' },
  { value: 'leefstijlarts', label: 'Leefstijlarts' },
  { value: 'admin',         label: 'Beheerder (admin)' },
]

export function UitnodigingForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState('medewerker')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [done,      setDone]      = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('Vul alle velden in.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/admin/medewerkers/uitnodigen', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ firstName, lastName, email, role }),
    })

    const json = await res.json()
    setSaving(false)

    if (!res.ok) {
      setError(json.error ?? 'Er is iets misgegaan.')
      return
    }

    setDone(true)
    router.refresh()
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
        <CheckCircle2 size={24} className="text-green-600 mx-auto" />
        <p className="text-sm font-semibold text-green-800">Uitnodiging verstuurd!</p>
        <p className="text-xs text-green-700">
          {firstName} ontvangt een e-mail met instructies om het account in te stellen en 2FA te activeren.
        </p>
        <button
          onClick={() => { setDone(false); setFirstName(''); setLastName(''); setEmail(''); setRole('medewerker') }}
          className="mt-2 text-xs text-green-700 underline hover:no-underline"
        >
          Nog een uitnodiging sturen
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[#475569] mb-1">Voornaam *</label>
          <input
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            placeholder="Jan"
            className={INPUT}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#475569] mb-1">Achternaam *</label>
          <input
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            placeholder="Jansen"
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#475569] mb-1">E-mailadres *</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="jan@voorbeeld.nl"
          className={INPUT}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#475569] mb-1">Rol *</label>
        <select
          value={role}
          onChange={e => setRole(e.target.value)}
          className={INPUT}
        >
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-red-600 rounded-lg bg-red-50 border border-red-200 px-3 py-2">{error}</p>
      )}

      {role === 'admin' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠️ Een beheerder heeft volledige toegang inclusief auditlog en gebruikersbeheer.
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50"
      >
        {saving
          ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Versturen…</span>
          : 'Uitnodiging versturen'
        }
      </button>

      <p className="text-[11px] text-[#94a3b8] text-center leading-relaxed">
        De uitgenodigde ontvang een e-mail met een link om wachtwoord in te stellen en 2FA te activeren. De link is 24 uur geldig.
      </p>
    </form>
  )
}
