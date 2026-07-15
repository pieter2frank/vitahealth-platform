import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { buildClientCaseText } from '@/lib/ai/case-document'
import { FOLLOWUP_DOMAINS } from '@/lib/annotation'
import { ANNOTATED_CASE_PREFIX } from '@/lib/knowledge-domains'
import { logAuditEvent } from '@/lib/audit'

// POST /api/annotatie/naar-training  { annotationIds: string[] }
// ADMIN zet één of meer geannoteerde casussen als CONCEPT in de trainingsmodule
// (vh_knowledge). Al geüploade annotaties worden overgeslagen. De curator
// controleert en indexeert de concepten daarna in de kennisbank.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(FOLLOWUP_DOMAINS.map(d => [d.value, d.label]))

interface AnnotationRow {
  id: string; round_id: string; client_id: string; arts_user_id: string
  algemeen_beeld: string | null; bespreken_team: boolean | null; advies: string | null
  verbeterpotentieel: number | null; vervolg_domeinen: string[] | null; wearables_nuttig: boolean | null
  training_uploaded_at: string | null
}

export async function POST(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(body.annotationIds)
    ? [...new Set((body.annotationIds as unknown[]).filter(v => typeof v === 'string' && isUuid(v)) as string[])]
    : []
  if (ids.length === 0) return NextResponse.json({ error: 'Geen annotaties geselecteerd.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: anns } = await admin
    .from('vh_annotation')
    .select('id, round_id, client_id, arts_user_id, algemeen_beeld, bespreken_team, advies, verbeterpotentieel, vervolg_domeinen, wearables_nuttig, training_uploaded_at')
    .in('id', ids)
  const rows = (anns ?? []) as AnnotationRow[]

  // Naam-lookups: arts (created_by) en rondetitel (source).
  const artsIds = [...new Set(rows.map(r => r.arts_user_id))]
  const roundIds = [...new Set(rows.map(r => r.round_id))]
  const [{ data: medewerkers }, { data: rounds }] = await Promise.all([
    admin.from('vh_medewerker').select('user_id, name').in('user_id', artsIds),
    admin.from('vh_annotation_round').select('id, title').in('id', roundIds),
  ])
  const artsName  = new Map((medewerkers ?? []).map(m => [m.user_id as string, m.name as string]))
  const roundName = new Map((rounds ?? []).map(r => [r.id as string, r.title as string]))

  const ja = (b: boolean | null) => (b == null ? '—' : b ? 'ja' : 'nee')
  let uploaded = 0, skipped = 0, failed = 0

  for (const ann of rows) {
    if (ann.training_uploaded_at) { skipped++; continue }
    try {
      const { data: highlights } = await admin.from('vh_annotation_highlight')
        .select('selected_text, note').eq('annotation_id', ann.id).order('created_at', { ascending: true })
      const caseDoc = await buildClientCaseText(ann.client_id)

      const domeinen = (ann.vervolg_domeinen ?? []).map(v => DOMAIN_LABEL[v] ?? v).join(', ') || '—'
      const beoordeling = [
        '', '### Beoordeling arts',
        ann.algemeen_beeld ? `- Algemeen beeld: ${ann.algemeen_beeld}` : null,
        `- Bespreken in medisch team: ${ja(ann.bespreken_team)}`,
        ann.advies ? `- Advies:\n${ann.advies}` : null,
        ann.verbeterpotentieel != null ? `- Verwacht verbeterpotentieel: ${ann.verbeterpotentieel}/10` : null,
        `- Vervolg-domeinen: ${domeinen}`,
        `- Wearables nuttig bij vervolg: ${ja(ann.wearables_nuttig)}`,
      ].filter(Boolean).join('\n')

      const hl = (highlights ?? []).filter(h => h.selected_text || h.note)
      const annotaties = hl.length
        ? ['', '### Aandachtspunten (annotaties)', ...hl.map(h => `- "${h.selected_text}"${h.note ? ` — ${h.note}` : ''}`)].join('\n')
        : ''

      const body = `${caseDoc.text}\n${beoordeling}\n${annotaties}`.trim()
      const rTitle = roundName.get(ann.round_id)

      const { data: doc, error } = await admin.from('vh_knowledge').insert({
        domain:       'algemeen',
        title:        `${caseDoc.title} (geannoteerd)`,
        body,
        content_type: 'text',
        source:       rTitle ? `${ANNOTATED_CASE_PREFIX} — ${rTitle}` : ANNOTATED_CASE_PREFIX,
        status:       'draft',
        created_by:   artsName.get(ann.arts_user_id) ?? 'annotatie',
      }).select('id').single()
      if (error || !doc) { failed++; continue }

      await admin.from('vh_annotation')
        .update({ training_uploaded_at: new Date().toISOString(), training_knowledge_id: doc.id })
        .eq('id', ann.id)
      uploaded++
    } catch (e) {
      console.error('[annotatie] naar training mislukt voor', ann.id, e)
      failed++
    }
  }

  logAuditEvent({
    actorUserId:  auth.userId,
    actorRole:    'admin',
    resourceType: 'annotation',
    action:       'export',
    outcome:      failed ? 'failed' : 'success',
    reason:       `Geannoteerde casussen naar trainingsmodule (${uploaded} nieuw, ${skipped} overgeslagen, ${failed} mislukt)`,
    metadata:     { uploaded, skipped, failed },
  }).catch(() => {})

  return NextResponse.json({ ok: true, uploaded, skipped, failed })
}
