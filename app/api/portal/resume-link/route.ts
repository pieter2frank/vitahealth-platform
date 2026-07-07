import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'
import { intakeHervattingEmail } from '@/lib/email/templates'
import { logAuditEvent } from '@/lib/audit'

// POST /api/portal/resume-link  { email }
// Zelf-service: stuurt een veilige hervat-link naar het GEREGISTREERDE adres als
// er een aanmelding met dat e-mailadres bestaat. Geeft altijd { ok: true } terug
// (uniform — onthult nooit of het adres bekend is; geen PII/token in de respons).

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}))
  const clean = typeof email === 'string' ? email.trim() : ''
  if (!clean || !clean.includes('@')) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, email')
    .ilike('email', clean)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Onbekend adres → stil, uniforme respons (geen enumeratie).
  if (!client?.email) return NextResponse.json({ ok: true })

  // Intake-token ophalen of aanmaken (het token is de secret voor veilig hervatten).
  const { data: existing } = await admin
    .from('vh_intake_token').select('token').eq('client_id', client.id).maybeSingle()
  let token = existing?.token
  if (!token) {
    const { data: created } = await admin
      .from('vh_intake_token').insert({ client_id: client.id }).select('token').single()
    token = created?.token
  }
  if (!token) return NextResponse.json({ ok: true })

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const resumeUrl = `${portalUrl}/portal/aanmelden?token=${token}`
  const { subject, html } = intakeHervattingEmail({ firstName: client.first_name, vragenlijstUrl: resumeUrl })

  await resend.emails.send({
    from:    `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to:      client.email,
    subject,
    html,
  }).catch(() => {})

  logAuditEvent({
    actorUserId:     null,
    actorRole:       'portaal_eigen_data',
    subjectClientId: client.id,
    resourceType:    'client',
    resourceId:      client.id,
    action:          'email_sent',
    outcome:         'success',
    reason:          'Zelf-service hervat-link verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
