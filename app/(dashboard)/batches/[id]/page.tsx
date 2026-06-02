import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Package, TestTube2, User, Building2, Stethoscope,
  CalendarCheck, StickyNote, CheckCircle2
} from 'lucide-react'
import { BatchActions } from './BatchActions'
import { BatchExportButton } from './BatchExportButton'
import { DeleteButton } from '@/components/ui/DeleteButton'
import type { Client, Company, Arbo } from '@/types'

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: batch } = await supabase
    .from('vh_batch')
    .select('*')
    .eq('id', id)
    .single()

  if (!batch) notFound()

  const { data: kitsRaw } = await supabase
    .from('vh_testkit')
    .select('id, barcode, retour_date, results_date, status, vh_client(id, first_name, last_name), vh_company(id, name), vh_arbo(id, name)')
    .eq('batch_id', id)
    .order('retour_date', { ascending: true })

  const kits = (kitsRaw ?? []).map(kit => {
    const c  = kit.vh_client  as unknown as Pick<Client, 'id' | 'first_name' | 'last_name'> | null
    const co = kit.vh_company as unknown as Pick<Company, 'id' | 'name'> | null
    const a  = kit.vh_arbo    as unknown as Pick<Arbo, 'id' | 'name'> | null
    return {
      id: kit.id,
      barcode: kit.barcode,
      retour_date: kit.retour_date as string | null,
      results_date: kit.results_date as string | null,
      status: kit.status as string,
      assignedName: c ? `${c.first_name} ${c.last_name}` : co?.name ?? a?.name ?? '—',
      assignedHref: c ? `/clienten/${c.id}` : co ? `/bedrijven/${co.id}` : a ? `/arbodiensten/${a.id}` : null,
      AssignedIcon: c ? User : co ? Building2 : a ? Stethoscope : null,
    }
  })

  const resultsReceived = batch.status === 'results_received'

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/batches" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar batches
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
              <Package size={20} className="text-[#1f1683]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono text-[#1e293b]">{batch.badge_id}</h1>
              <p className="text-sm text-[#64748b] mt-0.5">
                {kits.length} testkit{kits.length === 1 ? '' : 's'} · aangemaakt op {formatDate(batch.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {resultsReceived ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 size={13} />
                Resultaten ontvangen
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium bg-cyan-100 text-cyan-700 border-cyan-200">
                Verzonden naar NH
              </span>
            )}
            <BatchExportButton batchId={batch.id} />
            <DeleteButton
              table="vh_batch"
              id={batch.id}
              redirectTo="/batches"
              entityLabel={`batch ${batch.badge_id}`}
              blockedMessage={
                kits.length > 0
                  ? `Er zijn ${kits.length} testkits gekoppeld aan deze batch. Verwijder of ontkoppel de testkits eerst.`
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 mb-4">
        {/* Info kaart */}
        <div className="lg:col-span-1 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-[#1e293b]">Batchgegevens</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5">
                <CalendarCheck size={13} />Verzenddatum
              </dt>
              <dd className="font-medium text-[#1e293b]">{formatDate(batch.sent_date)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Aantal kits</dt>
              <dd className="font-medium text-[#1e293b]">{kits.length}</dd>
            </div>
            {batch.results_date && (
              <div className="flex justify-between">
                <dt className="text-[#64748b]">Resultaten</dt>
                <dd className="font-medium text-[#1e293b]">{formatDate(batch.results_date)}</dd>
              </div>
            )}
            {batch.notes && (
              <div className="pt-2 border-t border-[#f1f5f9]">
                <dt className="text-[#64748b] flex items-center gap-1.5 mb-1">
                  <StickyNote size={13} />Opmerkingen
                </dt>
                <dd className="text-[#1e293b] text-xs leading-relaxed">{batch.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Acties */}
        <div className="lg:col-span-2">
          {resultsReceived ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700">Resultaten ontvangen op {formatDate(batch.results_date)}</p>
                <p className="text-xs text-green-600 mt-0.5">
                  Alle {kits.length} testkits in deze batch staan op &ldquo;Resultaten beschikbaar&rdquo;.
                </p>
              </div>
            </div>
          ) : (
            <BatchActions batchId={batch.id} kitCount={kits.length} />
          )}
        </div>
      </div>

      {/* Testkits tabel */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        <div className="border-b border-[#e2e8f0] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
            <TestTube2 size={15} className="text-[#94a3b8]" />
            Testkits in deze batch ({kits.length})
          </h2>
        </div>
        {kits.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[#94a3b8]">Geen testkits gevonden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Barcode</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegewezen aan</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Retour</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Resultaten</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {kits.map((kit) => (
                <tr key={kit.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-[#1e293b]">{kit.barcode}</td>
                  <td className="px-4 py-3">
                    {kit.assignedHref && kit.AssignedIcon ? (
                      <Link href={kit.assignedHref} className="inline-flex items-center gap-1.5 text-[#1f1683] hover:underline">
                        <kit.AssignedIcon size={13} />
                        {kit.assignedName}
                      </Link>
                    ) : (
                      <span className="text-[#94a3b8]">{kit.assignedName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(kit.retour_date)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(kit.results_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/testkits/${kit.id}`} className="text-xs text-[#1f1683] hover:underline">
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
