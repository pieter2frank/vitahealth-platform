import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { sanitizeString, isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// POST /api/annotatie/bespreking  { title, meetingDate, clientIds[] }
// Maakt een casusbespreking aan met de gekozen dossiers (arts of admin).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const title = sanitizeString(b.title, 200)
  const meetingDate = typeof b.meetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.meetingDate) ? b.meetingDate : ''
  const clientIds: string[] = Array.isArray(b.clientIds)
    ? [...new Set((b.clientIds as unknown[]).filter(v => typeof v === 'string' && isUuid(v)) as string[])]
    : []

  if (!title) return NextResponse.json({ error: 'Titel is verplicht.' }, { status: 400 })
  if (!meetingDate) return NextResponse.json({ error: 'Kies een datum.' }, { status: 400 })
  if (clientIds.length === 0) return NextResponse.json({ error: 'Kies minstens één dossier.' }, { status: 400 })
  if (clientIds.length > 25) return NextResponse.json({ error: 'Maximaal 25 dossiers per bespreking.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: meeting, error } = await admin
    .from('vh_team_meeting')
    .insert({ title, meeting_date: meetingDate, created_by: auth.userId })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = clientIds.map((clientId, i) => ({ meeting_id: meeting.id, client_id: clientId, position: i }))
  const { error: caseErr } = await admin.from('vh_team_meeting_case').insert(rows)
  if (caseErr) return NextResponse.json({ error: caseErr.message }, { status: 500 })

  logAuditEvent({
    actorUserId: auth.userId,
    actorRole:   auth.role === 'admin' ? 'admin' : 'medisch_deskundige',
    resourceType: 'annotation',
    resourceId:  meeting.id as string,
    action:      'create',
    outcome:     'success',
    reason:      `Casusbespreking aangemaakt: ${title} (${clientIds.length} dossiers)`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, id: meeting.id })
}
