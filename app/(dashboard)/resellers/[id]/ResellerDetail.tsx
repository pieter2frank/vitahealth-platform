'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Loader2, XCircle, Plus, Trash2, Power, Save } from 'lucide-react'
import { formatEuro } from '@/lib/payments/pricing'

export interface PackageOption { id: string; name: string }
export interface ResellerData {
  id: string; name: string; contactPerson: string; email: string; phone: string
  address: string; postalCode: string; city: string; kvk: string; note: string; active: boolean
}
export interface ResellerCode {
  id: string; code: string; type: 'percent' | 'fixed'; value: number
  packageId: string | null; maxUses: number | null; usedCount: number
  validUntil: string | null; active: boolean
}

const discountLabel = (t: 'percent' | 'fixed', v: number) => (t === 'percent' ? `${v}%` : formatEuro(v))
const fmtDate = (iso: string | null) => { if (!iso) return '—'; try { return format(new Date(iso), 'd MMM yyyy', { locale: nl }) } catch { return '—' } }

export function ResellerDetail({ data, codes, packages }: { data: ResellerData; codes: ResellerCode[]; packages: PackageOption[] }) {
  const router = useRouter()
  const pkgName = new Map(packages.map(p => [p.id, p.name]))
  const [showCodeForm, setShowCodeForm] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggleCode(c: ResellerCode) {
    setBusyId(c.id)
    try { await fetch(`/api/discount-codes/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !c.active }) }); router.refresh() }
    finally { setBusyId(null) }
  }
  async function removeCode(c: ResellerCode) {
    if (!confirm(`Kortingscode "${c.code}" verwijderen?`)) return
    setBusyId(c.id)
    try { await fetch(`/api/discount-codes/${c.id}`, { method: 'DELETE' }); router.refresh() }
    finally { setBusyId(null) }
  }

  return (
    <>
      <h1 className="mb-5 text-xl font-bold text-[#1e293b]">{data.name}</h1>

      {/* Gegevens */}
      <ResellerForm data={data} onSaved={() => router.refresh()} />

      {/* Kortingscodes */}
      <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1e293b]">Kortingscodes van deze reseller</h2>
          <button onClick={() => setShowCodeForm(v => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f1683] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a1270]">
            <Plus size={14} /> Nieuwe code
          </button>
        </div>

        {showCodeForm && (
          <CreateCodeForm resellerId={data.id} packages={packages} onClose={() => setShowCodeForm(false)} onDone={() => { setShowCodeForm(false); router.refresh() }} />
        )}

        {codes.length === 0 ? (
          <p className="py-4 text-center text-sm text-[#94a3b8]">Nog geen kortingscode voor deze reseller.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-left text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  <th className="py-2">Code</th><th className="py-2">Korting</th><th className="py-2">Pakket</th>
                  <th className="py-2">Gebruik</th><th className="py-2">Geldig tot</th><th className="py-2">Status</th><th className="py-2 text-right">Acties</th>
                </tr>
              </thead>
              <tbody>
                {codes.map(c => (
                  <tr key={c.id} className="border-b border-[#f1f5f9] last:border-0">
                    <td className="py-2.5 font-mono font-semibold text-[#1e293b]">{c.code}</td>
                    <td className="py-2.5 font-medium text-[#1e293b]">{discountLabel(c.type, c.value)}</td>
                    <td className="py-2.5 text-[#64748b]">{c.packageId ? (pkgName.get(c.packageId) ?? '—') : 'Alle pakketten'}</td>
                    <td className="py-2.5 tabular-nums text-[#64748b]">{c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ''}</td>
                    <td className="py-2.5 text-[#64748b]">{fmtDate(c.validUntil)}</td>
                    <td className="py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${c.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {c.active ? 'Actief' : 'Inactief'}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleCode(c)} disabled={busyId === c.id} title={c.active ? 'Deactiveren' : 'Activeren'} className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50">
                          {busyId === c.id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                        </button>
                        <button onClick={() => removeCode(c)} disabled={busyId === c.id} title="Verwijderen" className="rounded-lg border border-[#e2e8f0] p-1.5 text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600 disabled:opacity-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function ResellerForm({ data, onSaved }: { data: ResellerData; onSaved: () => void }) {
  const router = useRouter()
  const [f, setF] = useState(data)
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')
  const set = (k: keyof ResellerData) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function save() {
    setState('saving'); setError('')
    try {
      const res = await fetch(`/api/resellers/${data.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name, contactPerson: f.contactPerson, email: f.email, phone: f.phone,
          address: f.address, postalCode: f.postalCode, city: f.city, kvk: f.kvk, note: f.note,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Opslaan mislukt.'); setState('error'); return }
      setState('idle'); onSaved()
    } catch { setError('Opslaan mislukt.'); setState('error') }
  }

  async function toggleActive() {
    await fetch(`/api/resellers/${data.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !data.active }) })
    router.refresh()
  }
  async function remove() {
    if (!confirm(`Reseller "${data.name}" verwijderen?`)) return
    const res = await fetch(`/api/resellers/${data.id}`, { method: 'DELETE' })
    if (res.ok) { router.push('/resellers'); return }
    const j = await res.json().catch(() => ({}))
    alert(j.error ?? 'Verwijderen mislukt.')
  }

  const label = 'mb-1 block text-xs font-semibold text-[#64748b]'
  const input = 'w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#1f1683] focus:outline-none'

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#1e293b]">Gegevens</h2>
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${data.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
          {data.active ? 'Actief' : 'Inactief'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className={label}>Naam <span className="text-red-500">*</span></label><input value={f.name} onChange={set('name')} className={input} /></div>
        <div><label className={label}>Contactpersoon</label><input value={f.contactPerson} onChange={set('contactPerson')} className={input} /></div>
        <div><label className={label}>E-mail</label><input value={f.email} onChange={set('email')} className={input} /></div>
        <div><label className={label}>Telefoon</label><input value={f.phone} onChange={set('phone')} className={input} /></div>
        <div><label className={label}>KVK</label><input value={f.kvk} onChange={set('kvk')} className={input} /></div>
        <div><label className={label}>Adres</label><input value={f.address} onChange={set('address')} className={input} /></div>
        <div><label className={label}>Postcode</label><input value={f.postalCode} onChange={set('postalCode')} className={input} /></div>
        <div><label className={label}>Plaats</label><input value={f.city} onChange={set('city')} className={input} /></div>
        <div className="sm:col-span-2 lg:col-span-3"><label className={label}>Notitie <span className="font-normal text-[#94a3b8]">(intern)</span></label><input value={f.note} onChange={set('note')} className={input} /></div>
      </div>

      {state === 'error' && <p className="mt-3 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={toggleActive} className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc]">
            {data.active ? 'Deactiveren' : 'Activeren'}
          </button>
          <button onClick={remove} className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600">
            Verwijderen
          </button>
        </div>
        <button onClick={save} disabled={state === 'saving' || !f.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a1270] disabled:opacity-60">
          {state === 'saving' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Opslaan
        </button>
      </div>
    </div>
  )
}

function CreateCodeForm({ resellerId, packages, onClose, onDone }: { resellerId: string; packages: PackageOption[]; onClose: () => void; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [type, setType] = useState<'percent' | 'fixed'>('percent')
  const [value, setValue] = useState('')
  const [packageId, setPackageId] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [error, setError] = useState('')

  async function submit() {
    setState('saving'); setError('')
    const numeric = Number(value.replace(',', '.'))
    const payloadValue = type === 'fixed' ? Math.round(numeric * 100) : Math.round(numeric)
    try {
      const res = await fetch('/api/discount-codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, type, value: payloadValue, packageId: packageId || null, maxUses: maxUses || null, validUntil: validUntil || null, resellerId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'Aanmaken mislukt.'); setState('error'); return }
      onDone()
    } catch { setError('Aanmaken mislukt.'); setState('error') }
  }

  const label = 'mb-1 block text-xs font-semibold text-[#64748b]'
  const input = 'w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:border-[#1f1683] focus:outline-none'

  return (
    <div className="mb-4 rounded-lg border border-[#e2e8f0] bg-[#fafbfc] p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div><label className={label}>Code</label><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="RESELLER10" className={`${input} font-mono`} /></div>
        <div><label className={label}>Type</label><select value={type} onChange={e => setType(e.target.value as 'percent' | 'fixed')} className={input}><option value="percent">Percentage (%)</option><option value="fixed">Vast bedrag (€)</option></select></div>
        <div><label className={label}>{type === 'percent' ? 'Percentage' : 'Bedrag (€)'}</label><input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal" placeholder={type === 'percent' ? '10' : '25,00'} className={input} /></div>
        <div><label className={label}>Pakket</label><select value={packageId} onChange={e => setPackageId(e.target.value)} className={input}><option value="">Alle pakketten</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label className={label}>Max. gebruik <span className="font-normal text-[#94a3b8]">(optioneel)</span></label><input value={maxUses} onChange={e => setMaxUses(e.target.value)} inputMode="numeric" placeholder="onbeperkt" className={input} /></div>
        <div><label className={label}>Geldig tot <span className="font-normal text-[#94a3b8]">(optioneel)</span></label><input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={input} /></div>
      </div>
      {state === 'error' && <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600"><XCircle size={13} /> {error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        <button onClick={onClose} disabled={state === 'saving'} className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#64748b] hover:bg-white">Annuleren</button>
        <button onClick={submit} disabled={state === 'saving'} className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1a1270] disabled:opacity-60">
          {state === 'saving' && <Loader2 size={14} className="animate-spin" />} Code aanmaken
        </button>
      </div>
    </div>
  )
}
