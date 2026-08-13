import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getClientRecord } from '@/lib/pii/identity'
import { reminderEmail, kitRetourReminderEmail } from '@/lib/email/templates'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { getOrCreateIntakeToken } from '@/lib/intake-token'
import { sendEmail } from '@/lib/email/send'

export async function POST(req: Request) {
  // Alleen voor ingelogde medewerkers
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const body = await req.json()
  const { clientId } = body
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  const admin = createAdminClient()

  // Fase 2 PII-kluis: dossier + identiteit via de toegangslaag.
  const client = await getClientRecord(admin, clientId)

  if (!client?.email) {
    return NextResponse.json({ error: 'Cliënt niet gevonden of geen e-mailadres.' }, { status: 404 })
  }

  // Welke herinnering? Kit verstuurd maar nog niet retour → retour-herinnering;
  // anders de intake-herinnering (die een hervat-token nodig heeft).
  const isKitReminder = client.enrollment_status === 'kit_opgestuurd'
  let subject: string, html: string

  if (isKitReminder) {
    ;({ subject, html } = kitRetourReminderEmail({ firstName: client.first_name }))
  } else {
    const token = await getOrCreateIntakeToken(admin, clientId)
    if (!token) return NextResponse.json({ error: 'Token aanmaken mislukt.' }, { status: 500 })

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
    const intakeUrl = `${portalUrl}/portal/aanmelden?token=${token}`

    const stoppedAfter: 'adresgegevens' | 'toestemmingen' =
      client.enrollment_status === 'toestemming_gegeven' ? 'toestemmingen' : 'adresgegevens'

    ;({ subject, html } = reminderEmail({ firstName: client.first_name, intakeUrl, stoppedAfter }))
  }

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
    reason:          isKitReminder ? 'Herinnering kit retour verstuurd' : 'Herinnering intake verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
