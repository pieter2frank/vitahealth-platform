import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ENROLLMENT_LABELS, type EnrollmentStatus } from '@/lib/enrollment'
import { UserCheck } from 'lucide-react'
import { AanvragenTable, type AanvraagRow } from './AanvragenTable'

// Statussen die "in behandeling" zijn — te verwerken door medewerkers/arts
const ACTIVE_STATUSES: EnrollmentStatus[] = [
  'aangemeld',
  'toestemming_gegeven',
  'vragenlijst_ingevuld',
  'intake_akkoord',
]

const STATUS_TABS: { key: string; label: string }[] = [
  { key: '',                    label: 'Alle' },
  { key: 'aangemeld',           label: 'Aangemeld' },
  { key: 'toestemming_gegeven', label: 'Toestemming' },
  { key: 'vragenlijst_ingevuld',label: 'Vragenlijst ingevuld' },
  { key: 'intake_akkoord',      label: 'Intake akkoord' },
]

export default async function AanvragenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const supabase = await createClient()

  // Toon cliënten die via het portal zijn aangemeld en nog verwerkt moeten worden
  let query = supabase
    .from('vh_client')
    .select('id, first_name, last_name, email, city, enrollment_status, created_at')
    .order('created_at', { ascending: false })

  if (status && ACTIVE_STATUSES.includes(status as EnrollmentStatus)) {
    query = query.eq('enrollment_status', status)
  } else {
    query = query.in('enrollment_status', ACTIVE_STATUSES)
  }

  const { data: clients, error } = await query

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Aanvragen</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Deelnemers die zich via het portal hebben aangemeld en verwerkt moeten worden.
          </p>
        </div>
      </div>

      {/* Statusfilters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => {
          const active = (tab.key === '' && !status) || tab.key === status
          return (
            <Link
              key={tab.key}
              href={tab.key ? `/aanvragen?status=${tab.key}` : '/aanvragen'}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                active
                  ? 'bg-[#1f1683] text-white border-[#1f1683]'
                  : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683] hover:text-[#1f1683]'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm px-5 py-8 text-center text-sm text-red-500">
          Fout bij ophalen aanvragen.
        </div>
      ) : !clients || clients.length === 0 ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm px-5 py-12 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f0f4ff] mb-3">
            <UserCheck size={22} className="text-[#1f1683]" />
          </div>
          <p className="text-sm text-[#94a3b8]">
            {status ? `Geen aanvragen met status "${ENROLLMENT_LABELS[status as EnrollmentStatus] ?? status}".` : 'Geen openstaande aanvragen.'}
          </p>
          <p className="text-xs text-[#94a3b8] mt-1">
            Aanvragen komen binnen via het deelnemersportaal.
          </p>
        </div>
      ) : (
        <AanvragenTable clients={clients as AanvraagRow[]} />
      )}
    </div>
  )
}
