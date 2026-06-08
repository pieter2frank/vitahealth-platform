import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { medewerkerUitnodigingEmail } from '@/lib/email/templates'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY)

const schema = z.object({
  firstName: z.string().min(1).max(80),
  lastName:  z.string().min(1).max(80),
  email:     z.string().email(),
  role:      z.enum(['admin', 'arts', 'leefstijlarts', 'medewerker']),
})

export async function POST(req: Request) {
  // ── Auth: alleen admin ─────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  }

  // ── Validatie ──────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }
  const { firstName, lastName, email, role } = parsed.data

  const admin = createAdminClient()

  // ── Controleer of e-mail al bestaat ───────────────────────────────────────
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
  if (alreadyExists) {
    return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik.' }, { status: 409 })
  }

  // ── Supabase invite aanmaken ───────────────────────────────────────────────
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const redirectTo = `${appUrl}/auth/invite/accept`

  const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { first_name: firstName, last_name: lastName },
  })

  if (inviteErr || !invite?.user) {
    console.error('[uitnodigen] invite error:', inviteErr)
    return NextResponse.json({ error: 'Uitnodiging aanmaken mislukt.' }, { status: 500 })
  }

  // ── vh_medewerker record aanmaken ──────────────────────────────────────────
  const { error: mwErr } = await admin
    .from('vh_medewerker')
    .insert({
      user_id: invite.user.id,
      name:    `${firstName} ${lastName}`,
      role,
    })

  if (mwErr) {
    console.error('[uitnodigen] vh_medewerker insert error:', mwErr)
    // Rol niet aangemaakt — verwijder de invite user weer
    await admin.auth.admin.deleteUser(invite.user.id)
    return NextResponse.json({ error: 'Medewerker opslaan mislukt.' }, { status: 500 })
  }

  // ── Eigen uitnodigingsmail sturen via Resend ───────────────────────────────
  // Supabase stuurt zelf ook een mail; wij overschrijven die met onze eigen
  // Nederlandse template. De invite-link halen we op via generateLink.
  const { data: linkData } = await admin.auth.admin.generateLink({
    type:       'invite',
    email,
    options:    { redirectTo },
  })

  const inviteUrl = linkData?.properties?.action_link ?? redirectTo

  const { subject, html } = medewerkerUitnodigingEmail({ firstName, role, inviteUrl })

  await resend.emails.send({
    from:    `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to:      email,
    subject,
    html,
  })

  logAuditEvent({
    actorUserId:  user.id,
    actorRole:    'admin',
    resourceType: 'medewerker',
    resourceId:   invite.user.id,
    action:       'email_sent',
    outcome:      'success',
    reason:       `Medewerker uitgenodigd als ${role}: ${firstName} ${lastName}`,
    metadata:     { role },
  }).catch(() => {})

  return NextResponse.json({ ok: true, userId: invite.user.id })
}
