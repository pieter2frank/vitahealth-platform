import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { buildClientCaseText } from '@/lib/ai/case-document'
import { FOLLOWUP_DOMAINS } from '@/lib/annotation'
import { logAuditEvent } from '@/lib/audit'

// POST /api/annotatie/naar-training  { roundId, clientId }
// Bouwt uit de (gepseudonimiseerde) casus + de annotatie van deze arts een
// kennisdocument en zet het als CONCEPT in de trainingsmodule (vh_knowledge).
// De curator controleert en indexeert het daarna in de kennisbank.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(FOLLOWUP_DOMAINS.map(d => [d.value, d.label]))

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { roundId, clientId } = await req.json().catch(() => ({}))
  if (!isUuid(roundId) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldige casus.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: ann } = await admin
    .from('vh_annotation')
    .select('id, algemeen_beeld, bespreken_team, advies, verbeterpotentieel, vervolg_domeinen, wearables_nuttig')
    .eq('round_id', roundId).eq('client_id', clientId).eq('arts_user_id', auth.userId)
    .maybeSingle()
  if (!ann) return NextResponse.json({ error: 'Nog geen annotatie om te uploaden.' }, { status: 400 })

  const [{ data: highlights }, { data: roundRow }, caseDoc] = await Promise.all([
    admin.from('vh_annotation_highlight').select('selected_text, note')
      .eq('annotation_id', ann.id).order('created_at', { ascending: true }),
    admin.from('vh_annotation_round').select('title').eq('id', roundId).maybeSingle(),
    buildClientCaseText(clientId),
  ])

  // ── Beoordeling van de arts ──────────────────────────────────────────────────
  const ja = (b: boolean | null) => (b == null ? '—' : b ? 'ja' : 'nee')
  const domeinen = (ann.vervolg_domeinen ?? []).map((v: string) => DOMAIN_LABEL[v] ?? v).join(', ') || '—'
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
    ? ['', '### Aandachtspunten (annotaties)',
       ...hl.map(h => `- "${h.selected_text}"${h.note ? ` — ${h.note}` : ''}`)].join('\n')
    : ''

  const body = `${caseDoc.text}\n${beoordeling}\n${annotaties}`.trim()

  const { data: doc, error } = await admin
    .from('vh_knowledge')
    .insert({
      domain:       'algemeen',
      title:        `${caseDoc.title} (geannoteerd)`,
      body,
      content_type: 'text',
      source:       roundRow?.title ? `Geannoteerde casus — ${roundRow.title}` : 'Geannoteerde casus',
      status:       'draft',
      created_by:   auth.name,
    })
    .select('id').single()
  if (error) {
    console.error('[annotatie] naar training mislukt:', error)
    return NextResponse.json({ error: 'Opslaan in trainingsmodule mislukt.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: clientId,
    resourceType:    'annotation',
    resourceId:      ann.id,
    action:          'export',
    outcome:         'success',
    reason:          'Geannoteerde casus naar trainingsmodule (concept)',
  }).catch(() => {})

  return NextResponse.json({ ok: true, id: doc.id })
}
