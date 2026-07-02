'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NieuweClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birth_date: '',
    address: '',
    city: '',
    postal_code: '',
  })

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      birth_date: form.birth_date || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
    }

    const { data, error: insertError } = await supabase
      .from('vh_client')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }

    // Uitnodigingsmail versturen als er een e-mailadres is ingevuld
    if (payload.email) {
      fetch('/api/email/uitnodiging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: data.id }),
      }).catch(() => { /* stil falen */ })
    }

    router.push(`/clienten/${data.id}`)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/clienten" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar cliënten
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Nieuwe cliënt</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Voeg een nieuwe cliënt toe aan het systeem.</p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-6">
        {/* Naam */}
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Persoonsgegevens</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Voornaam"
              value={form.first_name}
              onChange={e => set('first_name', e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Achternaam"
              value={form.last_name}
              onChange={e => set('last_name', e.target.value)}
              required
            />
          </div>
          <div className="mt-4">
            <DateInput
              label="Geboortedatum"
              value={form.birth_date}
              onChange={v => set('birth_date', v)}
            />
          </div>
        </div>

        <div className="border-t border-[#f1f5f9]" />

        {/* Contactgegevens */}
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Contactgegevens</h2>
          <div className="space-y-4">
            <Input
              label="E-mailadres"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              placeholder="naam@voorbeeld.nl"
            />
            <Input
              label="Telefoonnummer"
              type="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              placeholder="06-12345678"
            />
          </div>
        </div>

        <div className="border-t border-[#f1f5f9]" />

        {/* Adres */}
        <div>
          <h2 className="text-sm font-semibold text-[#1e293b] mb-3">Adres</h2>
          <div className="space-y-4">
            <Input
              label="Straat + huisnummer"
              value={form.address}
              onChange={e => set('address', e.target.value)}
              placeholder="Voorbeeldstraat 1"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Postcode"
                value={form.postal_code}
                onChange={e => set('postal_code', e.target.value)}
                placeholder="1234 AB"
              />
              <Input
                label="Plaats"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                placeholder="Amsterdam"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} size="lg">
            Cliënt opslaan
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/clienten')}>
            Annuleren
          </Button>
        </div>
      </form>
    </div>
  )
}
