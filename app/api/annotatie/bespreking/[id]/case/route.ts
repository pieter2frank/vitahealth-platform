import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// PATCH /api/annotatie/bespreking/[id]/case  { clientId, notes?, discussed? }
// Besprekingsnotities opslaan en/of een casus markeren als besproken
// (medisch team — de inhoud is medisch).

export const dynamic = 'force-dynamic'

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
