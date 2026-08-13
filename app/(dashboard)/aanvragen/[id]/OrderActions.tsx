'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserPlus, CheckCircle2, Send, XCircle } from 'lucide-react'

interface OrderData {
  id: string
  status: string
  client_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  address: string
  city: string
  postal_code: string
}

export function OrderActions({ order }: { order: OrderData }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function updateStatus(status: string) {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('vh_order').update({ status }).eq('id', order.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.refresh()
    setSaving(false)
  }

  async function createClient_() {
    setSaving(true)
    setError('')
    const supabase = createClient()

    // Maak cliëntprofiel aan vanuit aanvraagdata — via de server route (schrijft
    // oude kolommen + PII-kluis; de browser kan niet versleutelen).
    const createRes = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName:  order.first_name ?? '',
        lastName:   order.last_name ?? '',
        email:      order.email ?? '',
        phone:      order.phone ?? '',
        birthDate:  order.birth_date ?? '',
        address:    order.address ?? '',
        city:       order.city ?? '',
        postalCode: order.postal_code ?? '',
      }),
    })
    const client = await createRes.json().catch(() => ({}))

    if (!createRes.ok || !client.id) { setError(client.error ?? 'Cliënt aanmaken mislukt.'); setSaving(false); return }

    // Koppel cliënt aan aanvraag + zet status op bevestigd
    const { error: updateErr } = await supabase
      .from('vh_order')
      .update({ client_id: client.id, status: 'bevestigd' })
      .eq('id', order.id)

    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    router.push(`/clienten/${client.id}`)
  }

  if (order.status === 'afgerond' || order.status === 'geannuleerd') {
    return null
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-[#1e293b]">Acties</h2>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        {/* Cliëntprofiel aanmaken */}
        {!order.client_id && (
          <Button onClick={createClient_} loading={saving} className="gap-2">
            <UserPlus size={15} />
            Cliëntprofiel aanmaken
          </Button>
        )}

        {/* Status: bevestigd */}
        {order.status === 'nieuw' && order.client_id && (
          <Button onClick={() => updateStatus('bevestigd')} loading={saving} className="gap-2">
            <CheckCircle2 size={15} />
            Bevestigen
          </Button>
        )}

        {/* Status: kit verzonden */}
        {order.status === 'bevestigd' && (
          <Button onClick={() => updateStatus('kit_verzonden')} loading={saving} variant="accent" className="gap-2">
            <Send size={15} />
            Kit verzonden markeren
          </Button>
        )}

        {/* Status: afgerond */}
        {order.status === 'kit_verzonden' && (
          <Button onClick={() => updateStatus('afgerond')} loading={saving} className="gap-2">
            <CheckCircle2 size={15} />
            Aanvraag afronden
          </Button>
        )}

        {/* Annuleren */}
        {order.status !== 'geannuleerd' && (
          <Button
            onClick={() => updateStatus('geannuleerd')}
            loading={saving}
            variant="outline"
            className="gap-2 text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            <XCircle size={15} />
            Annuleren
          </Button>
        )}
      </div>

      <p className="text-xs text-[#94a3b8]">
        Tip: maak eerst een cliëntprofiel aan, wijs daarna via Testkits een kit toe aan deze cliënt.
      </p>
    </div>
  )
}
