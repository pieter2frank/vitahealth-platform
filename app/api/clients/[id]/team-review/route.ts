import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// POST /api/clients/[id]/team-review  { bespreken_team, team_vraag }
// Medisch-team-velden op dossierniveau — uitsluitend arts/leefstijlarts.

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const bespreken = typeof b.bespreken_team === 'boolean' ? b.bespreken_team : false
  const vraag = typeof b.team_vraag === 'string' ? (b.team_vraag.trim().slice(0, 2000) || null) : null

  const admin = createAdminClient()
  const { data: client } = await admin.from('vh_client').select('id').eq('id', id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })

  const { error } = await admin
    .from('vh_client_team_review')
    .upsert({
      client_id:      id,
      bespreken_team: bespreken,
      team_vraag:     vraag,
      updated_by:     auth.userId,
      updated_at:     new Date().toISOString(),
    })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: id,
    resourceType:    'client',
    resourceId:      id,
    action:          'update',
    outcome:         'success',
    reason:          `Medisch-team-velden bijgewerkt (bespreken: ${bespreken ? 'ja' : 'nee'}${vraag ? ', met vraag' : ''})`,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
