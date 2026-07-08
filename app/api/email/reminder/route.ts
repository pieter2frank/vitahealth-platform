import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reminderEmail } from '@/lib/email/templates'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { getOrCreateIntakeToken } from '@/lib/intake-token'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  // Alleen voor ingelogde medewerkers
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const body = await req.json()
  const { clientId } = body
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  const admin = createAdminClient()

  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, email, enrollment_status')
    .eq('id', clientId)
    .single()

  if (!client?.email) {
    return NextResponse.json({ error: 'Cliënt niet gevonden of geen e-mailadres.' }, { status: 404 })
  }

  // Token ophalen of aanmaken
  const token = await getOrCreateIntakeToken(admin, clientId)
  if (!token) return NextResponse.json({ error: 'Token aanmaken mislukt.' }, { status: 500 })

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const intakeUrl = `${portalUrl}/portal/aanmelden?token=${token}`

  const stoppedAfter: 'adresgegevens' | 'toestemmingen' =
    client.enrollment_status === 'toestemming_gegeven' ? 'toestemmingen' : 'adresgegevens'

  const { subject, html } = reminderEmail({
    firstName: client.first_name,
    intakeUrl,
    stoppedAfter,
  })

  const { error } = await resend.emails.send({
    from: `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to: client.email,
    subject,
    html,
  })

  if (error) {
    console.error('[email/reminder] Resend error:', error)
    return NextResponse.json({ error: 'E-mail kon niet worden verzonden.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'email_sent',
    outcome:         'success',
    reason:          'Herinnering verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
