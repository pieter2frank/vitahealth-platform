import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateIntakeToken } from '@/lib/intake-token'
import { uitnodigingEmail } from '@/lib/email/templates'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
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

  // Cliënt ophalen
  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, last_name, email')
    .eq('id', clientId)
    .single()

  if (!client?.email) {
    return NextResponse.json({ error: 'Cliënt niet gevonden of geen e-mailadres.' }, { status: 404 })
  }

  // Token ophalen of aanmaken
  const token = await getOrCreateIntakeToken(admin, clientId)
  if (!token) return NextResponse.json({ error: 'Token aanmaken mislukt.' }, { status: 500 })

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const intakeUrl = `${portalUrl}/portal/aanmelden?token=${token}`

  const { subject, html } = uitnodigingEmail({ firstName: client.first_name, intakeUrl, appUrl })

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
    reason:          'Uitnodiging (intakelink) verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

