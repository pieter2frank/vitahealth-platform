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
  const { data } = await supabase
    .from('vh_client_team_review')
    .select('bespreken_team, team_vraag, updated_at')
    .eq('client_id', clientId).maybeSingle()

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
    </div>
  )
}
