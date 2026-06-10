'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { DateFieldNL } from '@/components/ui/DateFieldNL'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Client } from '@/types'

const GENDER_OPTIONS = [
  { value: '',                label: '— Niet opgegeven' },
  { value: 'man',             label: 'Man' },
  { value: 'vrouw',           label: 'Vrouw' },
  { value: 'anders',          label: 'Anders' },
  { value: 'zeg_liever_niet', label: 'Zeg ik liever niet' },
]

export function EditClientForm({ client }: { client: Client }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email ?? '',
    phone: client.phone ?? '',
    birth_date: client.birth_date ?? '',
    gender: client.gender ?? '',
    address: client.address ?? '',
    city: client.city ?? '',
    postal_code: client.postal_code ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('vh_client')
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
      })
      .eq('id', client.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    router.push(`/clienten/${client.id}`)
    router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/clienten/${client.id}`} className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">
          {client.first_name} {client.last_name} bewerken
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Persoonsgegevens</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Voornaam" value={form.first_name} onChange={e => set('first_name', e.target.value)} required />
            <Input label="Achternaam" value={form.last_name} onChange={e => set('last_name', e.target.value)} required />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#1e293b]">Geboortedatum</label>
              <DateFieldNL
                value={form.birth_date}
                onChange={v => set('birth_date', v)}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#1e293b]">Geslacht</label>
              <select
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
              >
                {GENDER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="border-t border-[#f1f5f9]" />

        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Contactgegevens</h2>
          <div className="space-y-4">
            <Input label="E-mailadres" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            <Input label="Telefoonnummer" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>

        <div className="border-t border-[#f1f5f9]" />

        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Adres</h2>
          <div className="space-y-4">
            <Input label="Straat + huisnummer" value={form.address} onChange={e => set('address', e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Postcode" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
              <Input label="Plaats" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} size="lg">Opslaan</Button>
          <Button type="button" variant="outline" onClick={() => router.push(`/clienten/${client.id}`)}>
            Annuleren
          </Button>
        </div>
      </form>
    </div>
  )
}
