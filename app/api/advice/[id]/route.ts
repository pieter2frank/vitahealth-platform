import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth/guard'

// PATCH  /api/advice/:id  { text?, action?: 'approve' | 'reopen' }
//   - text: bewerk de conceptinhoud (human-in-the-loop)
//   - action 'approve': arts keurt het advies goed
//   - action 'reopen':  terug naar concept
// DELETE /api/advice/:id  — conceptadvies verwijderen
// Alleen arts/leefstijlarts.

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  const { data: advice } = await admin
    .from('vh_advice').select('id, client_id, content, status').eq('id', id).maybeSingle()
  if (!advice) return NextResponse.json({ error: 'Advies niet gevonden.' }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if (typeof b.text === 'string') {
    const content = (advice.content ?? {}) as Record<string, unknown>
    patch.content = { ...content, text: b.text }
  }

  let auditAction: 'update' | 'status_change' = 'update'
  if (b.action === 'approve') {
    patch.status = 'approved'
    patch.approved_by = auth.name
    patch.approved_at = new Date().toISOString()
    auditAction = 'status_change'
  } else if (b.action === 'reopen') {
    patch.status = 'draft'
    patch.approved_by = null
    patch.approved_at = null
    auditAction = 'status_change'
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Niets om bij te werken.' }, { status: 400 })
  }

  const { error } = await admin.from('vh_advice').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: advice.client_id as string,
    resourceType:    'client',
    resourceId:      advice.client_id as string,
    action:          auditAction,
    outcome:         'success',
    reason:          b.action === 'approve' ? 'Advies goedgekeurd' : b.action === 'reopen' ? 'Advies heropend' : 'Conceptadvies bewerkt',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: advice } = await admin.from('vh_advice').select('client_id').eq('id', id).maybeSingle()
  const { error } = await admin.from('vh_advice').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (advice) {
    await logAuditEvent({
      actorUserId:     auth.userId,
      actorRole:       'medisch_deskundige',
      subjectClientId: advice.client_id as string,
      resourceType:    'client',
      resourceId:      advice.client_id as string,
      action:          'delete',
      outcome:         'success',
      reason:          'Conceptadvies verwijderd',
    }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
