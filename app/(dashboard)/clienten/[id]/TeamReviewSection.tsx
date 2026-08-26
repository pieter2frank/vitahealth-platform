import { createClient } from '@/lib/supabase/server'
import { canSeeResults } from '@/lib/auth/roles'
import { Users } from 'lucide-react'
import { TeamReviewForm } from './TeamReviewForm'

// Medisch-team-velden op dossierniveau: "bespreken in medisch team" + open
// vraag van de beoordelaar aan het team. Alleen zichtbaar voor arts/
// leefstijlarts — de UI checkt de rol en de RLS op vh_client_team_review
// dwingt het leesniveau óók in de database af.

export async function TeamReviewSection({ clientId, viewerRole }: { clientId: string; viewerRole?: string }) {
  if (!canSeeResults(viewerRole)) return null

  const supabase = await createClient()
  const [{ data }, { data: besproken }] = await Promise.all([
    supabase
      .from('vh_client_team_review')
      .select('bespreken_team, team_vraag, updated_at')
      .eq('client_id', clientId).maybeSingle(),
    supabase
      .from('vh_team_meeting_case')
      .select('discussed, discussed_at, notes, vh_team_meeting ( title, meeting_date )')
      .eq('client_id', clientId).eq('discussed', true)
      .order('discussed_at', { ascending: false }),
  ])

  type MeetingRel = { title: string; meeting_date: string }
  const besprekingen = (besproken ?? []).map(b => {
    const m = (Array.isArray(b.vh_team_meeting) ? b.vh_team_meeting[0] : b.vh_team_meeting) as MeetingRel | null
    return { title: m?.title ?? 'Bespreking', date: m?.meeting_date ?? null, notes: b.notes as string | null }
  })

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]">
          <Users size={15} className="text-[#1f1683]" /> Medisch team
        </h2>
        <span className="text-[11px] text-[#94a3b8]">alleen zichtbaar voor medisch team</span>
      </div>
      <TeamReviewForm
        clientId={clientId}
        initialBespreken={data?.bespreken_team ?? false}
        initialVraag={data?.team_vraag ?? ''}
      />
      {besprekingen.length > 0 && (
        <div className="border-t border-[#f1f5f9] px-5 py-4">
          <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b8]">Besproken in expertteam</p>
          <div className="space-y-2.5">
            {besprekingen.map((b, i) => (
              <div key={i} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
                <p className="text-xs font-medium text-[#1e293b]">
                  {b.title}
                  {b.date && <span className="ml-1.5 font-normal text-[#94a3b8]">· {new Date(b.date + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
                </p>
                {b.notes
                  ? <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#334155]">{b.notes}</p>
                  : <p className="mt-1 text-xs italic text-[#94a3b8]">Geen notities vastgelegd.</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
