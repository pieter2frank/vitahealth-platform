import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { intakeHervattingEmail } from '@/lib/email/templates'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { sendEmail } from '@/lib/email/send'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const { clientId } = await req.json()
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  const admin = createAdminClient()

  // Cliënt ophalen
  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, email')
    .eq('id', clientId)
    .single()

  if (!client?.email) {
    return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })
  }

  // Meest recente vragenlijstopdracht ophalen
  const { data: assignment } = await admin
    .from('vh_questionnaire_assignment')
    .select('id')
    .eq('client_id', clientId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'Geen vragenlijst gevonden voor deze cliënt.' }, { status: 404 })
  }

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const vragenlijstUrl = `${portalUrl}/portal/vragenlijsten/${assignment.id}`

  // Status terugzetten naar toestemming_gegeven
  await admin
    .from('vh_client')
    .update({ enrollment_status: 'toestemming_gegeven' })
    .eq('id', clientId)

  const { subject, html } = intakeHervattingEmail({
    firstName: client.first_name,
    vragenlijstUrl,
  })

  const res = await sendEmail({ to: client.email, subject, html })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 })

  logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'email_sent',
    outcome:         'success',
    reason:          'Intake hervatten — vragenlijstlink verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
