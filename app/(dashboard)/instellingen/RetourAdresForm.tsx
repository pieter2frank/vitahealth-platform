'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CheckCircle2 } from 'lucide-react'

export interface RetourAdres {
  name:       string
  street:     string
  houseNr:    string
  houseNrExt: string
  zipcode:    string
  city:       string
  country:    string
}

const EMPTY: RetourAdres = {
  name: '', street: '', houseNr: '', houseNrExt: '', zipcode: '', city: '', country: 'NL',
}

export function RetourAdresForm({ current }: { current: RetourAdres | null }) {
  const [a, setA]       = useState<RetourAdres>({ ...EMPTY, ...(current ?? {}) })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  function set<K extends keyof RetourAdres>(key: K, val: string) {
    setA(prev => ({ ...prev, [key]: val })); setSaved(false)
  }

  async function handleSave() {
    setError(''); setSaved(false)
    // Minimale validatie
    if (!a.name.trim() || !a.street.trim() || !a.houseNr.trim() || !a.zipcode.trim() || !a.city.trim()) {
      setError('Vul minimaal naam, straat, huisnummer, postcode en plaats in.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const value: RetourAdres = {
      name:       a.name.trim(),
      street:     a.street.trim(),
      houseNr:    a.houseNr.trim(),
      houseNrExt: a.houseNrExt.trim(),
      zipcode:    a.zipcode.replace(/\s+/g, '').toUpperCase(),
      city:       a.city.trim(),
      country:    (a.country.trim() || 'NL').toUpperCase(),
    }
    const { error: err } = await supabase.from('vh_setting').upsert({
      key:        'retour_adres',
      value:      JSON.stringify(value),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = 'w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]'
  const label = 'block text-xs font-medium text-[#64748b] mb-1'

  return (
    <div className="space-y-4">
      <div>
        <label className={label}>Naam / bedrijf</label>
        <input className={field} value={a.name} onChange={e => set('name', e.target.value)} placeholder="Bijv. Vita Health — Retour" />
      </div>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-6">
          <label className={label}>Straat</label>
          <input className={field} value={a.street} onChange={e => set('street', e.target.value)} placeholder="Straatnaam" />
        </div>
        <div className="col-span-3">
          <label className={label}>Huisnr.</label>
          <input className={field} value={a.houseNr} onChange={e => set('houseNr', e.target.value)} placeholder="31" />
        </div>
        <div className="col-span-3">
          <label className={label}>Toevoeging</label>
          <input className={field} value={a.houseNrExt} onChange={e => set('houseNrExt', e.target.value)} placeholder="A" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-4">
          <label className={label}>Postcode</label>
          <input className={field} value={a.zipcode} onChange={e => set('zipcode', e.target.value)} placeholder="7382BS" />
        </div>
        <div className="col-span-5">
          <label className={label}>Plaats</label>
          <input className={field} value={a.city} onChange={e => set('city', e.target.value)} placeholder="Klarenbeek" />
        </div>
        <div className="col-span-3">
          <label className={label}>Land</label>
          <input className={field} value={a.country} onChange={e => set('country', e.target.value)} placeholder="NL" />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 size={13} /> Opgeslagen
          </span>
        )}
      </div>
    </div>
  )
}
