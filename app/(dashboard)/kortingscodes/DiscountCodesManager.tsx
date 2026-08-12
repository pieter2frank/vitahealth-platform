'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Loader2, XCircle, Plus, Trash2, Power } from 'lucide-react'
import { formatEuro } from '@/lib/payments/pricing'

export interface PackageOption { id: string; name: string }
export interface CodeRow {
  id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  packageId: string | null
  packageName: string | null
  resellerName?: string | null
  maxUses: number | null
  usedCount: number
  validUntil: string | null
  active: boolean
  note: string | null
}

function discountLabel(type: 'percent' | 'fixed', value: number): string {
  return type === 'percent' ? `${value}%` : formatEuro(value)
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try { return format(new Date(iso), 'd MMM yyyy', { locale: nl }) } catch { return '—' }
}

export function DiscountCodesManager({ rows, packages }: { rows: CodeRow[]; packages: PackageOption[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggle(row: CodeRow) {
    setBusyId(row.id)
    try {
      await fetch(`/api/discount-codes/${row.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !row.active }),
      })
      router.refresh()
    } finally { setBusyId(null) }
  }

  async function remove(row: CodeRow) {
    if (!confirm(`Kortingscode "${row.code}" definitief verwijderen?`)) return
    setBusyId(row.id)
    try {
      await fetch(`/api/discount-codes/${row.id}`, { method: 'DELETE' })
      router.refresh()
    } finally { setBusyId(null) }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1270]"
        >
          <Plus size={15} /> Nieuwe code
        </button>
      </div>

      {showForm && (
        <CreateForm packages={packages} onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); router.refresh() }} />
      )}

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc] text-left text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Korting</th>
                <th className="px-4 py-3">Pakket</th>
                <th className="px-4 py-3">Gebruik</th>
                <th className="px-4 py-3">Geldig tot</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-[#94a3b8]">Nog geen kortingscodes.</td></tr>
              )}
              {rows.map(r => (
                <tr key={r.id} className="border-b border-[#f1f5f9] last:border-0 hover:bg-[#fafbfc]">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-[#1e293b]">{r.code}</span>
                    {r.resellerName && (
                      <div className="mt-0.5 inline-flex items-center rounded-full border border-[#c7d7fd] bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#1f1683]">
                        Reseller: {r.resellerName}
                      </div>
                    )}
                    {r.note && <div className="text-xs text-[#94a3b8]">{r.note}</div>}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{discountLabel(r.type, r.value)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{r.packageName ?? 'Alle pakketten'}</td>
                  <td className="px-4 py-3 tabular-nums text-[#64748b]">{r.usedCount}{r.maxUses != null ? ` / ${r.maxUses}` : ''}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#64748b]">{fmtDate(r.validUntil)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                      r.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'
                    }`}>
                      {r.active ? 'Actief' : 'Inactief'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggle(r)}
                        disabled={busyId === r.id}
                        title={r.active ? 'Deactiveren' : 'Activeren'}
                        className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
                      >
                        {busyId === r.id ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} />}
                      </button>
                      <button
                        onClick={() => remove(r)}
                        disabled={busyId === r.id}
                        title="Verwijderen"
                        className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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

function CreateForm({ packages, onClose, onDone }: { packages: PackageOption[]; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [packageId, setPackageId] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit() {
    setState('saving'); setError('')
    // Vast bedrag wordt in euro ingevoerd → centen; percentage blijft heel getal.
    const numeric = Number(value.replace(',', '.'))
    const payloadValue = type === 'fixed' ? Math.round(numeric * 100) : Math.round(numeric)
    try {
      const res = await fetch('/api/discount-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code, type, value: payloadValue,
          packageId: packageId || null,
          maxUses: maxUses || null,
          validUntil: validUntil || null,
          note,
        }),
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
      <h2 className="mb-4 text-sm font-semibold text-[#1e293b]">Nieuwe kortingscode</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={label}>Code</label>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ZOMER10" className={`${input} font-mono`} />
        </div>
        <div>
          <label className={label}>Type</label>
          <select value={type} onChange={e => setType(e.target.value as 'percent' | 'fixed')} className={input}>
            <option value="percent">Percentage (%)</option>
            <option value="fixed">Vast bedrag (€)</option>
          </select>
        </div>
        <div>
          <label className={label}>{type === 'percent' ? 'Percentage' : 'Bedrag (€)'}</label>
          <input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" placeholder={type === 'percent' ? '10' : '25,00'} className={input} />
        </div>
        <div>
          <label className={label}>Pakket</label>
          <select value={packageId} onChange={e => setPackageId(e.target.value)} className={input}>
            <option value="">Alle pakketten</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Max. gebruik <span className="font-normal text-[#94a3b8]">(optioneel)</span></label>
          <input value={maxUses} onChange={e => setMaxUses(e.target.value)} inputMode="numeric" placeholder="onbeperkt" className={input} />
        </div>
        <div>
          <label className={label}>Geldig tot <span className="font-normal text-[#94a3b8]">(optioneel)</span></label>
          <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={input} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={label}>Notitie <span className="font-normal text-[#94a3b8]">(optioneel, intern)</span></label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="bijv. actie nieuwsbrief augustus" className={input} />
        </div>
      </div>

      {state === 'error' && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={state === 'saving'} className="rounded-lg px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">
          Annuleren
        </button>
        <button
          onClick={submit}
          disabled={state === 'saving'}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1270] disabled:opacity-60"
        >
          {state === 'saving' && <Loader2 size={14} className="animate-spin" />}
          Code aanmaken
        </button>
      </div>
    </div>
  )
}
