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

  // ── Extra waarborg: de rol 'admin' kan UITSLUITEND door een admin worden
  //    toegekend. Defense in depth — blijft gelden ook als de toegang tot dit
  //    endpoint ooit voor andere rollen wordt opengesteld.
  if (role === 'admin' && self.role !== 'admin') {
    return NextResponse.json(
      { error: 'Alleen een beheerder mag de admin-rol toekennen.' },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  // ── Controleer of e-mail al bestaat ───────────────────────────────────────
  const { data: existing } = await admin.auth.admin.listUsers()
  const alreadyExists = existing?.users.some(u => u.email?.toLowerCase() === email.toLowerCase())
  if (alreadyExists) {
    return NextResponse.json({ error: 'Dit e-mailadres is al in gebruik.' }, { status: 409 })
  }

  // ── Invite-link genereren (maakt de gebruiker aan, verstuurt GEEN mail) ─────
  // Belangrijk: gebruik generateLink i.p.v. inviteUserByEmail, anders stuurt
  // Supabase zelf óók een (Engelse) mail met een localhost-link. Wij sturen
  // uitsluitend onze eigen Nederlandse mail via Resend.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const redirectTo = `${appUrl}/auth/invite/accept`

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    'invite',
    email,
    options: { redirectTo, data: { first_name: firstName, last_name: lastName } },
  })

  if (linkErr || !linkData?.user) {
    console.error('[uitnodigen] generateLink error:', linkErr)
    return NextResponse.json({ error: 'Uitnodiging aanmaken mislukt.' }, { status: 500 })
  }

  const newUserId = linkData.user.id
  // Bouw de link naar onze eigen confirm-route (server-side verifyOtp) i.p.v.
  // de Supabase action_link, zodat de sessie betrouwbaar wordt opgezet.
  const tokenHash = linkData.properties?.hashed_token
  const inviteUrl = tokenHash
    ? `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=invite&next=${encodeURIComponent('/auth/invite/accept')}`
    : (linkData.properties?.action_link ?? redirectTo)

  // ── vh_medewerker record aanmaken ──────────────────────────────────────────
  const { error: mwErr } = await admin
    .from('vh_medewerker')
    .insert({
      user_id: newUserId,
      name:    `${firstName} ${lastName}`,
      role,
    })

  if (mwErr) {
    console.error('[uitnodigen] vh_medewerker insert error:', mwErr)
    await admin.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: 'Medewerker opslaan mislukt.' }, { status: 500 })
  }

  // ── Eigen uitnodigingsmail sturen via Resend ───────────────────────────────
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
    resourceId:   newUserId,
    action:       'email_sent',
    outcome:      'success',
    reason:       `Medewerker uitgenodigd als ${role}: ${firstName} ${lastName}`,
    metadata:     { role },
  }).catch(() => {})

  return NextResponse.json({ ok: true, userId: newUserId })
}
