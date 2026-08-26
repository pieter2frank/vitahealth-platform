import Link from 'next/link'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { caseLabel } from '@/lib/annotation'
import { getIdentities } from '@/lib/pii/identity'
import { CalendarDays, ChevronRight, CheckCircle2, Clock } from 'lucide-react'
import { NewMeetingForm, type Candidate } from './NewMeetingForm'

// Casusbesprekingen medisch expertteam: lijst + aanmaken (arts of admin).
// Het dashboard zelf (bespreking/[id]) is alleen voor arts/leefstijlarts.

export const dynamic = 'force-dynamic'

const fmtDatum = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default async function BesprekingenPage() {
  const { role } = await requireAnnotationAccess(['arts', 'leefstijlarts', 'admin'])
  const admin = createAdminClient()

  const [{ data: meetings }, { data: meetingCases }] = await Promise.all([
    admin.from('vh_team_meeting').select('id, title, meeting_date, status, created_at').order('meeting_date', { ascending: false }),
    admin.from('vh_team_meeting_case').select('meeting_id, discussed'),
  ])

  const countByMeeting = new Map<string, { total: number; done: number }>()
  for (const c of meetingCases ?? []) {
    const cur = countByMeeting.get(c.meeting_id) ?? { total: 0, done: 0 }
    cur.total += 1
    if (c.discussed) cur.done += 1
    countByMeeting.set(c.meeting_id, cur)
  }

  // Kandidaat-dossiers voor een nieuwe bespreking: cliënten met een uitslag of
  // annotatie. Dossiers die als "bespreken in team" zijn gemarkeerd (dossierveld
  // of annotatie) staan bovenaan en zijn voorgeselecteerd.
  const [{ data: reports }, { data: anns }, { data: reviews }, { data: clients }] = await Promise.all([
    admin.from('vh_report').select('client_id'),
    admin.from('vh_annotation').select('client_id, bespreken_team'),
    admin.from('vh_client_team_review').select('client_id, bespreken_team').eq('bespreken_team', true),
    admin.from('vh_client').select('id, gender'),
  ])
  const genderById = new Map((clients ?? []).map(c => [c.id, c.gender as string | null]))
  const flagged = new Set<string>([
    ...(reviews ?? []).map(r => r.client_id as string),
    ...(anns ?? []).filter(a => a.bespreken_team === true).map(a => a.client_id as string),
  ])
  const candidateIds = [...new Set([
    ...(reports ?? []).map(r => r.client_id as string),
    ...(anns ?? []).map(a => a.client_id as string),
  ])]
  const idents = await getIdentities(admin, candidateIds)
  const candidates: Candidate[] = candidateIds
    .map(id => {
      const ident = idents.get(id)
      return {
        clientId: id,
        label: caseLabel(ident?.birthDate ?? null, genderById.get(id) ?? null),
        name: [ident?.firstName, ident?.lastName].filter(Boolean).join(' ') || null,
        flagged: flagged.has(id),
      }
    })
    .sort((a, b) => Number(b.flagged) - Number(a.flagged) || a.label.localeCompare(b.label))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1e293b]">Casusbesprekingen</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          Bespreek dossiers met het medisch expertteam — per casus alle informatie op één scherm.
        </p>
      </div>

      <NewMeetingForm candidates={candidates} />

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        {(meetings ?? []).length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#94a3b8]">Nog geen besprekingen gepland.</p>
        ) : (
          <ul className="divide-y divide-[#f1f5f9]">
            {(meetings ?? []).map(m => {
              const cnt = countByMeeting.get(m.id) ?? { total: 0, done: 0 }
              const klaar = m.status === 'afgerond' || (cnt.total > 0 && cnt.done === cnt.total)
              return (
                <li key={m.id}>
                  <Link href={role === 'admin' ? '#' : `/bespreking/${m.id}`}
                    className={`flex items-center justify-between gap-3 px-5 py-3.5 transition-colors ${role === 'admin' ? 'cursor-default' : 'hover:bg-[#f8fafc]'}`}>
                    <span className="flex items-center gap-3">
                      <CalendarDays size={16} className="shrink-0 text-[#1f1683]" />
                      <span>
                        <span className="block text-sm font-medium text-[#1e293b]">{m.title}</span>
                        <span className="block text-xs text-[#94a3b8]">{fmtDatum(m.meeting_date)}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      {klaar ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          <CheckCircle2 size={11} /> {cnt.done}/{cnt.total} besproken
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          <Clock size={11} /> {cnt.done}/{cnt.total} besproken
                        </span>
                      )}
                      {role !== 'admin' && <ChevronRight size={15} className="text-[#cbd5e1]" />}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {role === 'admin' && (
        <p className="text-xs text-[#94a3b8]">
          Als admin kun je besprekingen aanmaken; het inhoudelijke dashboard is voorbehouden aan het medisch team.
        </p>
      )}
    </div>
  )
}
