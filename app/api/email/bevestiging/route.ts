import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { bevestigingEmail } from '@/lib/email/templates'
import { REQUIRED_CONSENTS } from '@/lib/consents'
import { isUuid } from '@/lib/validation'

const resend = new Resend(process.env.RESEND_API_KEY)

// Publiek endpoint — aanroepen vanuit portaal EnrollmentForm na afronden intake.
// Verificatie via clientId + assignmentId combinatie in de database.
export async function POST(req: Request) {
  const body = await req.json()
  const { clientId, assignmentId } = body
  if (!isUuid(clientId) || !isUuid(assignmentId)) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verificeer dat assignment bij de client hoort
  const { data: assignment } = await admin
    .from('vh_questionnaire_assignment')
    .select('id')
    .eq('id', assignmentId)
    .eq('client_id', clientId)
    .single()

  if (!assignment) {
    return NextResponse.json({ error: 'Ongeldige combinatie.' }, { status: 400 })
  }

  // Cliënt ophalen
  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, email')
    .eq('id', clientId)
    .single()

  if (!client?.email) return NextResponse.json({ ok: true }) // geen email → stil falen

  // Token ophalen of aanmaken
  const token = await getOrCreateToken(admin, clientId)
  if (!token) {
    console.error('[email/bevestiging] Token aanmaken mislukt voor client', clientId)
    return NextResponse.json({ ok: true }) // niet fataal voor de gebruiker
  }

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const statusUrl = `${portalUrl}/status/${token}`

  const { subject, html } = bevestigingEmail({
    firstName: client.first_name,
    statusUrl,
    consents: REQUIRED_CONSENTS,
  })

  const { error } = await resend.emails.send({
    from: `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to: client.email,
    subject,
    html,
  })

  if (error) {
    console.error('[email/bevestiging] Resend error:', error)
  }

  return NextResponse.json({ ok: true, statusUrl })
}

async function getOrCreateToken(admin: ReturnType<typeof createAdminClient>, clientId: string) {
  const { data: existing } = await admin
    .from('vh_intake_token')
    .select('token')
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) return existing.token

  const { data: created } = await admin
    .from('vh_intake_token')
    .insert({ client_id: clientId })
    .select('token')
    .single()

  return created?.token ?? null
}
