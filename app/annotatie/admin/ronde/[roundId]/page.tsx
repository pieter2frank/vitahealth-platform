import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { caseLabel } from '@/lib/annotation'
import { getIdentity } from '@/lib/pii/identity'
import { isUuid } from '@/lib/validation'
import { UploadTable, type Row } from './UploadTable'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

type ClientRel = { gender: string | null }

export default async function RondeDetail({ params }: { params: Promise<{ roundId: string }> }) {
  const { roundId } = await params
  await requireAnnotationAccess(['admin'])
  if (!isUuid(roundId)) notFound()

  const admin = createAdminClient()

  const { data: round } = await admin
    .from('vh_annotation_round').select('title, note, status').eq('id', roundId).maybeSingle()
  if (!round) notFound()

  const [{ data: cases }, { data: anns }] = await Promise.all([
    admin.from('vh_annotation_case').select('client_id, vh_client ( gender )').eq('round_id', roundId),
    admin.from('vh_annotation')
      .select('id, client_id, arts_user_id, status, training_uploaded_at, time_spent_seconds')
      .eq('round_id', roundId),
  ])

  // PII-kluis fase 4: geboortedatum via de toegangslaag (niet meer op vh_client).
  const labelByClient = new Map<string, string>()
  await Promise.all((cases ?? []).map(async c => {
    const cl = (Array.isArray(c.vh_client) ? c.vh_client[0] : c.vh_client) as ClientRel | null
    const identity = await getIdentity(admin, c.client_id)
    labelByClient.set(c.client_id, caseLabel(identity?.birthDate ?? null, cl?.gender ?? null))
  }))

  const artsIds = [...new Set((anns ?? []).map(a => a.arts_user_id))]
  const { data: med } = artsIds.length
    ? await admin.from('vh_medewerker').select('user_id, name').in('user_id', artsIds)
    : { data: [] as { user_id: string; name: string }[] }
  const nameByArts = new Map((med ?? []).map(m => [m.user_id as string, m.name as string]))

  const rows: Row[] = (anns ?? [])
    .map(a => ({
      annotationId: a.id as string,
      clientLabel:  labelByClient.get(a.client_id) ?? 'Casus',
      artsName:     nameByArts.get(a.arts_user_id) ?? '—',
      status:       a.status as string,
      uploaded:     Boolean(a.training_uploaded_at),
      timeSeconds:  (a.time_spent_seconds as number | null) ?? 0,
    }))
    .sort((x, y) => x.clientLabel.localeCompare(y.clientLabel) || x.artsName.localeCompare(y.artsName))

  return (
    <div className="space-y-5">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1f1683]">
        <ArrowLeft size={15} /> Terug naar rondes
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-[#1e293b]">{round.title}</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          {rows.length} annotatie{rows.length === 1 ? '' : 's'} · selecteer en zet ze in de trainingsmodule.
        </p>
      </div>

      <UploadTable rows={rows} />
    </div>
  )
}
