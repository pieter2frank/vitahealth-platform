import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, User, Mail, Phone, MapPin, Calendar } from 'lucide-react'
import { OrderActions } from './OrderActions'

export default async function AanvraagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order } = await supabase
    .from('vh_order')
    .select('*')
    .eq('id', id)
    .single()

  if (!order) notFound()

  const { data: client } = order.client_id
    ? await supabase.from('vh_client').select('id, first_name, last_name').eq('id', order.client_id).single()
    : { data: null }

  const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    nieuw:         { label: 'Nieuw',         cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    bevestigd:     { label: 'Bevestigd',     cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    kit_verzonden: { label: 'Kit verzonden', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
    afgerond:      { label: 'Afgerond',      cls: 'bg-green-100 text-green-700 border-green-200' },
    geannuleerd:   { label: 'Geannuleerd',   cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  }
  const s = STATUS_MAP[order.status] ?? { label: order.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <Link href="/aanvragen" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar aanvragen
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e293b]">
              {order.first_name} {order.last_name}
            </h1>
            <p className="text-sm text-[#64748b] mt-0.5">
              Aangevraagd op {formatDateTime(order.created_at)}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${s.cls}`}>
            {s.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mb-4">
        {/* Persoonsgegevens */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <User size={15} className="text-[#94a3b8]" />
            Persoonsgegevens
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Naam</dt>
              <dd className="font-medium text-[#1e293b]">{order.first_name} {order.last_name}</dd>
            </div>
            {order.birth_date && (
              <div className="flex justify-between">
                <dt className="text-[#64748b] flex items-center gap-1.5"><Calendar size={13} />Geboortedatum</dt>
                <dd className="font-medium text-[#1e293b]">{formatDate(order.birth_date)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><Mail size={13} />E-mail</dt>
              <dd className="font-medium text-[#1e293b]">{order.email}</dd>
            </div>
            {order.phone && (
              <div className="flex justify-between">
                <dt className="text-[#64748b] flex items-center gap-1.5"><Phone size={13} />Telefoon</dt>
                <dd className="font-medium text-[#1e293b]">{order.phone}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><MapPin size={13} />Adres</dt>
              <dd className="font-medium text-[#1e293b] text-right">
                {order.address}<br />
                {order.postal_code} {order.city}
              </dd>
            </div>
          </dl>
        </div>

        {/* Gekoppelde cliënt */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <User size={15} className="text-[#94a3b8]" />
            Cliëntprofiel
          </h2>
          {client ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <User size={15} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">
                    {(client as { first_name: string; last_name: string }).first_name} {(client as { first_name: string; last_name: string }).last_name}
                  </p>
                  <p className="text-xs text-green-600">Cliëntprofiel aangemaakt</p>
                </div>
              </div>
              <Link
                href={`/clienten/${order.client_id}`}
                className="block text-center text-sm text-[#1f1683] hover:underline"
              >
                Naar cliëntprofiel →
              </Link>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#e2e8f0] p-4 text-center text-sm text-[#94a3b8]">
              <p className="mb-1">Nog geen cliëntprofiel aangemaakt.</p>
              <p className="text-xs">Gebruik de actie hieronder om het profiel aan te maken.</p>
            </div>
          )}
        </div>
      </div>

      {/* Acties */}
      <OrderActions order={{
        id: order.id,
        status: order.status,
        client_id: order.client_id,
        first_name: order.first_name,
        last_name: order.last_name,
        email: order.email,
        phone: order.phone,
        birth_date: order.birth_date,
        address: order.address,
        city: order.city,
        postal_code: order.postal_code,
      }} />
    </div>
  )
}
