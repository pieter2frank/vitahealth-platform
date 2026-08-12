'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, XCircle, Plus, ChevronRight } from 'lucide-react'
import { formatEuro } from '@/lib/payments/pricing'

export interface ResellerRow {
  id: string
  name: string
  contactPerson: string | null
  email: string | null
  phone: string | null
  city: string | null
  active: boolean
  codeCount: number
  usedCount: number
  grossCents: number
  netCents: number
}

export function ResellersManager({ rows }: { rows: ResellerRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1270]"
        >
          <Plus size={15} /> Nieuwe reseller
        </button>
      </div>

      {showForm && <CreateForm onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); router.refresh() }} />}

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3">Naam</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Codes</th>
                <th className="px-4 py-3 text-right">Gebruikt</th>
                <th className="px-4 py-3 text-right">Bruto</th>
                <th className="px-4 py-3 text-right">Netto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#94a3b8]">Nog geen resellers.</td></tr>
              )}
              {rows.map(r => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/resellers/${r.id}`)}
                  className="cursor-pointer border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc]"
                >
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{r.name}</td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {r.contactPerson || '—'}
                    {r.email && <div className="text-xs text-[#94a3b8]">{r.email}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[#64748b]">{r.codeCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#64748b]">{r.usedCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-[#1e293b]">{formatEuro(r.grossCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-[#64748b]">{formatEuro(r.netCents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      r.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}>
                      {r.active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/resellers/${r.id}`} onClick={e => e.stopPropagation()} className="inline-flex text-[#94a3b8] hover:text-[#1f1683]">
                      <ChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function CreateForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', contactPerson: '', email: '', phone: '', address: '', postalCode: '', city: '', kvk: '', note: '' })
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function submit() {
    setState('saving'); setError('')
    try {
      const res = await fetch('/api/resellers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Aanmaken mislukt.'); setState('error'); return }
      onDone()
    } catch { setError('Aanmaken mislukt.'); setState('error') }
  }

  const label = 'mb-1 block text-xs font-semibold text-[#64748b]'
  const input = 'w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#1f1683] focus:outline-none'

  return (
    <div className="mb-4 rounded-xl border border-[#e2e8f0] bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-[#1e293b]">Nieuwe reseller</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className={label}>Naam <span className="text-red-500">*</span></label><input value={f.name} onChange={set('name')} className={input} placeholder="Bedrijfsnaam" /></div>
        <div><label className={label}>Contactpersoon</label><input value={f.contactPerson} onChange={set('contactPerson')} className={input} /></div>
        <div><label className={label}>E-mail</label><input value={f.email} onChange={set('email')} className={input} placeholder="naam@bedrijf.nl" /></div>
        <div><label className={label}>Telefoon</label><input value={f.phone} onChange={set('phone')} className={input} /></div>
        <div><label className={label}>KVK</label><input value={f.kvk} onChange={set('kvk')} className={input} /></div>
        <div><label className={label}>Adres</label><input value={f.address} onChange={set('address')} className={input} /></div>
        <div><label className={label}>Postcode</label><input value={f.postalCode} onChange={set('postalCode')} className={input} /></div>
        <div><label className={label}>Plaats</label><input value={f.city} onChange={set('city')} className={input} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><label className={label}>Notitie <span className="font-normal text-[#94a3b8]">(intern)</span></label><input value={f.note} onChange={set('note')} className={input} /></div>
      </div>

      {state === 'error' && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={state === 'saving'} className="rounded-lg px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">Annuleren</button>
        <button onClick={submit} disabled={state === 'saving' || !f.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1270] disabled:opacity-60">
          {state === 'saving' && <Loader2 size={14} className="animate-spin" />} Reseller aanmaken
        </button>
      </div>
    </div>
  )
}
