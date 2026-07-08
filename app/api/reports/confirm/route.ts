import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { requireRole } from '@/lib/auth/guard'

// POST /api/reports/confirm  { reportId }
// Arts bevestigt de uitgelezen waarden → parse_status 'parsed'.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  const { reportId } = await req.json().catch(() => ({}))
  if (!isUuid(reportId)) return NextResponse.json({ error: 'Ongeldig reportId.' }, { status: 400 })

  const { data: rep, error } = await admin
    .from('vh_report')
    .update({ parse_status: 'parsed' })
    .eq('id', reportId)
    .select('id, client_id')
    .single()
  if (error || !rep) return NextResponse.json({ error: 'Bevestigen mislukt.' }, { status: 500 })

  await logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: rep.client_id,
    resourceType:    'client_document',
    resourceId:      rep.id,
    action:          'status_change',
    outcome:         'success',
    reason:          'Uitgelezen rapportwaarden bevestigd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
