'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, UserMinus, Loader2 } from 'lucide-react'

export interface AddCandidate { clientId: string; label: string; name: string | null }

// Samenstelling van de bespreking aanpassen: dossier toevoegen (dropdown) en
// de huidige casus verwijderen. Na een wijziging her-rendert de pagina.
export function ManageCases({ meetingId, currentClientId, candidates, caseCount }: {
  meetingId: string
  currentClientId: string
  candidates: AddCandidate[]
  caseCount: number
}) {
  const router = useRouter()
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState<'' | 'add' | 'remove'>('')
  const [error, setError] = useState('')

  async function add() {
    if (!pick) return
    setBusy('add'); setError('')
    const res = await fetch(`/api/annotatie/bespreking/${meetingId}/case`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: pick }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { setError(j.error ?? 'Toevoegen mislukt.'); return }
    setPick('')
    router.refresh()
  }

  async function remove() {
    if (!confirm('Deze casus uit de bespreking verwijderen? De besprekingsnotities van deze casus gaan daarbij verloren.')) return
    setBusy('remove'); setError('')
    const res = await fetch(`/api/annotatie/bespreking/${meetingId}/case?clientId=${currentClientId}`, { method: 'DELETE' })
    const j = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { setError(j.error ?? 'Verwijderen mislukt.'); return }
    if (caseCount <= 1) { router.push('/besprekingen'); return } // laatste casus weg → terug naar de lijst
    router.replace('?c=0')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <select value={pick} onChange={e => setPick(e.target.value)}
        className="max-w-64 rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs text-[#1e293b] focus:border-[#1f1683] focus:outline-none">
        <option value="">— dossier toevoegen —</option>
        {candidates.map(c => (
          <option key={c.clientId} value={c.clientId}>{c.label}{c.name ? ` · ${c.name}` : ''}</option>
        ))}
      </select>
      <button onClick={add} disabled={busy !== '' || !pick}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc] disabled:opacity-50">
        {busy === 'add' ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />} Toevoegen
      </button>
      <button onClick={remove} disabled={busy !== ''}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
        {busy === 'remove' ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />} Verwijder deze casus
      </button>
    </div>
  )
}
