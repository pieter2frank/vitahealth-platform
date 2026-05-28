'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Arbo } from '@/types'

export function EditArboForm({ arbo }: { arbo: Arbo }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: arbo.name,
    contact_name: arbo.contact_name ?? '',
    email: arbo.email ?? '',
    phone: arbo.phone ?? '',
    address: arbo.address ?? '',
    city: arbo.city ?? '',
    postal_code: arbo.postal_code ?? '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('vh_arbo')
      .update({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        postal_code: form.postal_code.trim() || null,
      })
      .eq('id', arbo.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/arbodiensten/${arbo.id}`)
    router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={`/arbodiensten/${arbo.id}`} className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">{arbo.name} bewerken</h1>
      </div>
      <form onSubmit={handleSubmit} className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Gegevens arbodienst</h2>
          <div className="space-y-4">
            <Input label="Naam arbodienst" value={form.name} onChange={e => set('name', e.target.value)} required />
            <Input label="Contactpersoon" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
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
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} size="lg">Opslaan</Button>
          <Button type="button" variant="outline" onClick={() => router.push(`/arbodiensten/${arbo.id}`)}>Annuleren</Button>
        </div>
      </form>
    </div>
  )
}
