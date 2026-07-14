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

  if (!client) {
    return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })
  }

  // ── 1. Kernactie: hold ALTIJD opheffen (los van de e-mail) ──────────────────
  // Alleen vanuit on-hold terugzetten, zodat we geen verdere status overschrijven.
  const { error: updErr } = await admin
    .from('vh_client')
    .update({ enrollment_status: 'toestemming_gegeven' })
    .eq('id', clientId)
    .eq('enrollment_status', 'intake_on_hold')

  if (updErr) {
    console.error('[intake-hervatten] status terugzetten mislukt:', updErr)
    return NextResponse.json({ error: 'Blokkade opheffen mislukt.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: clientId,
    resourceType:    'enrollment_status',
    resourceId:      clientId,
    action:          'status_change',
    outcome:         'success',
    reason:          'On-hold opgeheven — deelname toegestaan',
    metadata:        { from: 'intake_on_hold', to: 'toestemming_gegeven' },
  }).catch(() => {})

  // ── 2. Best-effort: vragenlijstlink mailen (mag falen zonder de hold te blokkeren) ─
  let warning: string | undefined

  const { data: assignment } = await admin
    .from('vh_questionnaire_assignment')
    .select('id')
    .eq('client_id', clientId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!client.email) {
    warning = 'Blokkade opgeheven, maar de cliënt heeft geen e-mailadres — stuur de vragenlijst handmatig.'
  } else if (!assignment) {
    warning = 'Blokkade opgeheven, maar er is nog geen vragenlijst gekoppeld — koppel er een en verstuur die.'
  } else {
    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
    const vragenlijstUrl = `${portalUrl}/portal/vragenlijsten/${assignment.id}`
    const { subject, html } = intakeHervattingEmail({ firstName: client.first_name, vragenlijstUrl })

    const res = await sendEmail({ to: client.email, subject, html })
    if (res.ok) {
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
    } else {
      warning = `Blokkade opgeheven, maar de e-mail kon niet worden verstuurd (${res.error}). Verstuur de vragenlijst handmatig.`
    }
  }

  return NextResponse.json({ ok: true, warning })
}
