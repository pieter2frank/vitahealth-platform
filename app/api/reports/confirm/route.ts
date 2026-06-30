import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// POST /api/reports/confirm  { reportId }
// Arts bevestigt de uitgelezen waarden → parse_status 'parsed'.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('vh_medewerker').select('role').eq('user_id', user.id).maybeSingle()
  if (!me || !['arts', 'leefstijlarts'].includes(me.role)) {
    return NextResponse.json({ error: 'Alleen voor arts/leefstijlarts.' }, { status: 403 })
  }

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
    actorUserId:     user.id,
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
