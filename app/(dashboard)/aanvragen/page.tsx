import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { ENROLLMENT_LABELS, ENROLLMENT_COLORS, type EnrollmentStatus } from '@/lib/enrollment'
import { UserCheck, Clock } from 'lucide-react'

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

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">
            Fout bij ophalen aanvragen.
          </div>
        ) : !clients || clients.length === 0 ? (
          <div className="px-5 py-12 text-center">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Naam</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">E-mail</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Stad</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Aanmeldstatus</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Aangemeld op</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Actie</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {clients.map((c) => {
                const es = c.enrollment_status as EnrollmentStatus
                // Bepaal wat de volgende actie is
                const nextAction =
                  es === 'aangemeld'            ? 'Wacht op toestemming' :
                  es === 'toestemming_gegeven'  ? 'Wacht op vragenlijst' :
                  es === 'vragenlijst_ingevuld' ? 'Wacht op arts ✓' :
                  es === 'intake_akkoord'       ? 'Kit koppelen en opsturen' : ''
                return (
                  <ClickableRow key={c.id} href={`/clienten/${c.id}`} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#1e293b]">
                      {c.first_name} {c.last_name}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-[#64748b]">{c.city ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${ENROLLMENT_COLORS[es] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {ENROLLMENT_LABELS[es] ?? es}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{formatDateTime(c.created_at)}</td>
                    <td className="px-4 py-3">
                      {nextAction && (
                        <span className="inline-flex items-center gap-1 text-xs text-[#64748b]">
                          <Clock size={11} />
                          {nextAction}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                  </ClickableRow>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
