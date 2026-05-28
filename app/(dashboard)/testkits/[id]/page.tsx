import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { ArrowLeft, TestTube2, User, Building2, Stethoscope, CheckCircle2, Circle } from 'lucide-react'
import { StatusActions } from './StatusActions'
import { DeleteButton } from '@/components/ui/DeleteButton'
import type { Client, Company, Arbo } from '@/types'

export default async function TestkitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: kit } = await supabase
    .from('vh_testkit')
    .select('*, vh_client(*), vh_company(*), vh_arbo(*)')
    .eq('id', id)
    .single()

  if (!kit) notFound()

  const client = kit.vh_client as Client | null
  const company = kit.vh_company as Company | null
  const arbo = kit.vh_arbo as Arbo | null

  const assignedTo = client
    ? { label: `${client.first_name} ${client.last_name}`, sub: client.email, href: `/clienten/${client.id}`, icon: User }
    : company
    ? { label: company.name, sub: company.contact_name, href: `/bedrijven/${company.id}`, icon: Building2 }
    : arbo
    ? { label: arbo.name, sub: arbo.contact_name, href: `/arbodiensten/${arbo.id}`, icon: Stethoscope }
    : null

  const steps: { key: string; label: string; date: string | null; extra?: React.ReactNode }[] = [
    { key: 'received',         label: 'Ontvangen',          date: kit.date },
    { key: 'assigned',         label: 'Toegewezen',         date: kit.assigned_date },
    { key: 'retour',           label: 'Retour ontvangen',   date: kit.retour_date },
    {
      key: 'sent_nightingale',
      label: 'Verzonden naar Nightingale',
      date: kit.badge_datesent,
      extra: kit.badge_id ? (
        <span className="text-xs text-[#64748b]">Badge: <span className="font-mono">{kit.badge_id}</span></span>
      ) : undefined,
    },
    { key: 'results_available', label: 'Resultaten beschikbaar', date: kit.results_date },
  ]

  const statusOrder = ['received', 'assigned', 'retour', 'sent_nightingale', 'results_available']
  const currentIndex = statusOrder.indexOf(kit.status)

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/testkits" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar testkits
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#eef4ff] flex items-center justify-center">
              <TestTube2 size={20} className="text-[#1f1683]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono text-[#1e293b]">{kit.barcode}</h1>
              <p className="text-sm text-[#64748b] mt-0.5">Ingevoerd op {formatDateTime(kit.date)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLORS[kit.status as keyof typeof STATUS_COLORS]}`}>
              {STATUS_LABELS[kit.status as keyof typeof STATUS_LABELS]}
            </span>
            <DeleteButton
              table="vh_testkit"
              id={kit.id}
              redirectTo="/testkits"
              entityLabel={`testkit ${kit.barcode}`}
              blockedMessage={
                kit.assigned
                  ? 'Deze testkit is gekoppeld aan een cliënt, bedrijf of arbodienst. Ontkoppel de testkit eerst via "Toewijzing ontkoppelen" voordat je hem verwijdert.'
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Toewijzing */}
        <div className="lg:col-span-1 rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4">Toegewezen aan</h2>
          {assignedTo ? (
            <Link
              href={assignedTo.href}
              className="flex items-start gap-3 rounded-lg border border-[#e2e8f0] p-3 hover:bg-[#f8fafc] transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
                <assignedTo.icon size={15} className="text-[#1f1683]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1e293b] truncate">{assignedTo.label}</p>
                {assignedTo.sub && (
                  <p className="text-xs text-[#64748b] truncate">{assignedTo.sub}</p>
                )}
              </div>
            </Link>
          ) : (
            <div className="rounded-lg border border-dashed border-[#e2e8f0] p-4 text-center">
              <p className="text-sm text-[#94a3b8]">Niet toegewezen</p>
              <Link href={`/testkits/intake`} className="text-xs text-[#1f1683] hover:underline mt-1 inline-block">
                Toewijzen →
              </Link>
            </div>
          )}

          {/* Datums overzicht */}
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between text-[#64748b]">
              <span>Ingescand</span>
              <span className="font-medium text-[#1e293b]">{formatDate(kit.date)}</span>
            </div>
            {kit.assigned_date && (
              <div className="flex justify-between text-[#64748b]">
                <span>Toegewezen</span>
                <span className="font-medium text-[#1e293b]">{formatDate(kit.assigned_date)}</span>
              </div>
            )}
            {kit.retour_date && (
              <div className="flex justify-between text-[#64748b]">
                <span>Retour</span>
                <span className="font-medium text-[#1e293b]">{formatDate(kit.retour_date)}</span>
              </div>
            )}
            {kit.badge_datesent && (
              <div className="flex justify-between text-[#64748b]">
                <span>Verzonden NHG</span>
                <span className="font-medium text-[#1e293b]">{formatDate(kit.badge_datesent)}</span>
              </div>
            )}
            {kit.results_date && (
              <div className="flex justify-between text-[#64748b]">
                <span>Resultaten</span>
                <span className="font-medium text-[#1e293b]">{formatDate(kit.results_date)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Timeline + acties */}
        <div className="lg:col-span-2 space-y-4">
          {/* Statusverloop */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#1e293b] mb-4">Statusverloop</h2>
            <div className="space-y-0">
              {steps.map((step, i) => {
                const stepIndex = statusOrder.indexOf(step.key)
                const done = stepIndex < currentIndex
                const active = stepIndex === currentIndex
                const pending = stepIndex > currentIndex

                return (
                  <div key={step.key} className="flex gap-3">
                    {/* Icoon + lijn */}
                    <div className="flex flex-col items-center">
                      <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                        done   ? 'bg-green-100'  :
                        active ? 'bg-[#eef4ff]'  :
                                 'bg-[#f8fafc]'
                      }`}>
                        {done ? (
                          <CheckCircle2 size={15} className="text-green-600" />
                        ) : (
                          <Circle size={15} className={active ? 'text-[#1f1683]' : 'text-[#cbd5e1]'} />
                        )}
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`w-0.5 flex-1 my-1 ${done ? 'bg-green-200' : 'bg-[#e2e8f0]'}`} style={{ minHeight: '16px' }} />
                      )}
                    </div>

                    {/* Tekst */}
                    <div className="pb-4 min-w-0">
                      <p className={`text-sm font-medium ${
                        done ? 'text-green-700' : active ? 'text-[#1f1683]' : 'text-[#94a3b8]'
                      }`}>
                        {step.label}
                        {active && <span className="ml-2 text-xs font-normal text-[#1f1683]">← huidig</span>}
                      </p>
                      {step.date ? (
                        <p className="text-xs text-[#64748b] mt-0.5">{formatDateTime(step.date)}</p>
                      ) : pending ? (
                        <p className="text-xs text-[#cbd5e1]">—</p>
                      ) : null}
                      {step.extra && <div className="mt-0.5">{step.extra}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Acties */}
          <StatusActions kit={{
            id: kit.id,
            status: kit.status,
            badge_id: kit.badge_id,
            assigned: kit.assigned,
          }} />
        </div>
      </div>
    </div>
  )
}
