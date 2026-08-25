import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { FOLLOWUP_VALUES } from '@/lib/annotation'

// POST /api/annotatie/annotatie  — sla de annotatie van de arts op (concept of ingediend).
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { roundId, clientId, submit } = body
  if (!isUuid(roundId) || !isUuid(clientId)) {
    return NextResponse.json({ error: 'Ongeldige casus.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // De casus moet in deze ronde bestaan (voorkomt schrijven op willekeurige dossiers).
  const { data: caseRow } = await admin
    .from('vh_annotation_case').select('id')
    .eq('round_id', roundId).eq('client_id', clientId).maybeSingle()
  if (!caseRow) return NextResponse.json({ error: 'Casus niet gevonden in deze ronde.' }, { status: 404 })

  // Velden normaliseren/valideren.
  const potentieel = body.verbeterpotentieel
  const domeinen = Array.isArray(body.vervolg_domeinen)
    ? (body.vervolg_domeinen as unknown[]).filter(v => typeof v === 'string' && FOLLOWUP_VALUES.includes(v))
    : []

  const payload: Record<string, unknown> = {
    round_id:           roundId,
    client_id:          clientId,
    arts_user_id:       auth.userId,
    algemeen_beeld:     typeof body.algemeen_beeld === 'string' ? body.algemeen_beeld.slice(0, 4000) : null,
    bespreken_team:     typeof body.bespreken_team === 'boolean' ? body.bespreken_team : null,
    team_vraag:         typeof body.team_vraag === 'string' ? (body.team_vraag.trim().slice(0, 2000) || null) : null,
    advies:             typeof body.advies === 'string' ? body.advies.slice(0, 4000) : null,
    verbeterpotentieel: Number.isInteger(potentieel) && potentieel >= 0 && potentieel <= 10 ? potentieel : null,
    vervolg_domeinen:   domeinen,
    wearables_nuttig:   typeof body.wearables_nuttig === 'boolean' ? body.wearables_nuttig : null,
    status:             submit ? 'ingediend' : 'concept',
    updated_at:         new Date().toISOString(),
  }
  if (submit) payload.submitted_at = new Date().toISOString()

  const { error } = await admin
    .from('vh_annotation')
    .upsert(payload, { onConflict: 'round_id,client_id,arts_user_id' })
  if (error) {
    console.error('[annotatie] opslaan mislukt:', error)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: clientId,
    resourceType:    'annotation',
    resourceId:      caseRow.id,
    action:          submit ? 'annotation_submitted' : 'annotation_saved',
    outcome:         'success',
    reason:          submit ? 'Annotatie ingediend' : 'Annotatie als concept opgeslagen',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
