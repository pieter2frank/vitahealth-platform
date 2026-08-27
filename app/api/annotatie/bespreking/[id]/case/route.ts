import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// PATCH  /api/annotatie/bespreking/[id]/case  { clientId, notes?, discussed? }
//        — notities opslaan en/of markeren als besproken (medisch team)
// POST   — casus toevoegen aan de bespreking   { clientId }
// DELETE — casus verwijderen uit de bespreking ?clientId=…
//        (samenstelling: medisch team of admin)

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const clientId = typeof b.clientId === 'string' ? b.clientId : ''
  if (!isUuid(id) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('vh_team_meeting_case').select('id, position').eq('meeting_id', id).order('position', { ascending: false })
  if ((existing ?? []).length >= 25) return NextResponse.json({ error: 'Maximaal 25 dossiers per bespreking.' }, { status: 400 })

  const { error } = await admin.from('vh_team_meeting_case').insert({
    meeting_id: id,
    client_id:  clientId,
    position:   ((existing ?? [])[0]?.position ?? -1) + 1,
    updated_by: auth.userId,
  })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Dit dossier staat al in de bespreking.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const clientId = new URL(req.url).searchParams.get('clientId') ?? ''
  if (!isUuid(id) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vh_team_meeting_case').delete()
    .eq('meeting_id', id).eq('client_id', clientId)
    .select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Casus niet gevonden in deze bespreking.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const clientId = typeof b.clientId === 'string' ? b.clientId : ''
  if (!isUuid(id) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_by: auth.userId, updated_at: new Date().toISOString() }
  if (b.notes !== undefined) {
    patch.notes = typeof b.notes === 'string' ? (b.notes.trim().slice(0, 8000) || null) : null
  }
  if (typeof b.discussed === 'boolean') {
    patch.discussed = b.discussed
    patch.discussed_at = b.discussed ? new Date().toISOString() : null
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vh_team_meeting_case')
    .update(patch)
    .eq('meeting_id', id).eq('client_id', clientId)
    .select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Casus niet gevonden in deze bespreking.' }, { status: 404 })

  if (typeof b.discussed === 'boolean' && b.discussed) {
    // Casus is besproken → het dossiervlaggetje "bespreken in team" gaat uit,
    // zodat het dossier niet opnieuw wordt voorgeselecteerd bij een volgende
    // bespreking. (De vraagtekst blijft staan als context.)
    await admin
      .from('vh_client_team_review')
      .update({ bespreken_team: false, updated_by: auth.userId, updated_at: new Date().toISOString() })
      .eq('client_id', clientId)
      .eq('bespreken_team', true)

    logAuditEvent({
      actorUserId:     auth.userId,
      actorRole:       'medisch_deskundige',
      subjectClientId: clientId,
      resourceType:    'annotation',
      resourceId:      data.id as string,
      action:          'update',
      outcome:         'success',
      reason:          'Casus gemarkeerd als besproken in medisch expertteam',
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
