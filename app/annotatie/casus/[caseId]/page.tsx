import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildClientCaseStructured } from '@/lib/annotation-case'
import { caseLabel, type AnnotationFields } from '@/lib/annotation'
import { AnnotatieForm } from './AnnotatieForm'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CasusPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params
  const { userId } = await requireAnnotationAccess(['arts', 'leefstijlarts'])
  if (!isUuid(caseId)) notFound()

  const admin = createAdminClient()

  const { data: caseRow } = await admin
    .from('vh_annotation_case')
    .select('id, round_id, client_id, vh_annotation_round ( title, status ), vh_client ( gender, birth_date )')
    .eq('id', caseId)
    .maybeSingle()

  if (!caseRow) notFound()

  const round  = Array.isArray(caseRow.vh_annotation_round) ? caseRow.vh_annotation_round[0] : caseRow.vh_annotation_round
  const client = Array.isArray(caseRow.vh_client) ? caseRow.vh_client[0] : caseRow.vh_client

  const [{ sections }, { data: existing }, { data: report }] = await Promise.all([
    buildClientCaseStructured(caseRow.client_id),
    admin.from('vh_annotation')
      .select('id, algemeen_beeld, bespreken_team, team_vraag, advies, verbeterpotentieel, vervolg_domeinen, wearables_nuttig, status')
      .eq('round_id', caseRow.round_id).eq('client_id', caseRow.client_id).eq('arts_user_id', userId)
      .maybeSingle(),
    admin.from('vh_report').select('document_id').eq('client_id', caseRow.client_id)
      .order('sample_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  // Bestaande highlights van deze arts bij deze casus.
  const { data: highlights } = existing?.id
    ? await admin.from('vh_annotation_highlight')
        .select('id, selected_text, note').eq('annotation_id', existing.id)
        .order('created_at', { ascending: true })
    : { data: [] as { id: string; selected_text: string; note: string | null }[] }

  // AVG: het inzien van een casus (gezondheidsdata) vastleggen.
  logAuditEvent({
    actorUserId:     userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: caseRow.client_id,
    resourceType:    'annotation',
    resourceId:      caseRow.id,
    action:          'view',
    outcome:         'success',
    reason:          'Casus geopend in annotatiemodule',
  }).catch(() => {})

  const initial: AnnotationFields & { status: string } = {
    algemeen_beeld:     existing?.algemeen_beeld ?? '',
    bespreken_team:     existing?.bespreken_team ?? null,
    team_vraag:         existing?.team_vraag ?? '',
    advies:             existing?.advies ?? '',
    verbeterpotentieel: existing?.verbeterpotentieel ?? null,
    vervolg_domeinen:   existing?.vervolg_domeinen ?? [],
    wearables_nuttig:   existing?.wearables_nuttig ?? null,
    status:             existing?.status ?? 'open',
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1f1683]">
          <ArrowLeft size={15} /> Terug naar casussen
        </Link>
        {round?.title && <span className="text-xs text-[#94a3b8]">{round.title}</span>}
      </div>

      <h1 className="mb-4 text-xl font-semibold text-[#1e293b]">
        {caseLabel(client?.birth_date ?? null, client?.gender ?? null)}
      </h1>

      <AnnotatieForm
        roundId={caseRow.round_id}
        clientId={caseRow.client_id}
        sections={sections}
        hasPdf={Boolean(report?.document_id)}
        initial={initial}
        initialHighlights={highlights ?? []}
      />
    </div>
  )
}
