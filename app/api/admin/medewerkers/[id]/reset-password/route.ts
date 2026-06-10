/**
 * POST /api/admin/medewerkers/[id]/reset-password
 *
 * Stuurt de medewerker een wachtwoord-herstel e-mail (zelfde robuuste flow als
 * de self-service reset: generateLink recovery → /auth/confirm). Alleen admin.
 */
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wachtwoordResetEmail } from '@/lib/email/templates'
import { isUuid } from '@/lib/validation'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('vh_medewerker').select('user_id, name').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })

  // E-mail van de auth-gebruiker ophalen
  const { data: authUser } = await admin.auth.admin.getUserById(target.user_id)
  const email = authUser?.user?.email
  if (!email) return NextResponse.json({ error: 'Geen e-mailadres gevonden.' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type:    'recovery',
    email,
    options: { redirectTo: `${appUrl}/auth/wachtwoord-herstellen` },
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Herstellink aanmaken mislukt.' }, { status: 500 })
  }

  const resetUrl = `${appUrl}/auth/confirm?token_hash=${linkData.properties.hashed_token}`
    + `&type=recovery&next=${encodeURIComponent('/auth/wachtwoord-herstellen')}`
  const firstName = (target.name ?? '').split(' ')[0] || 'collega'

  const { subject, html } = wachtwoordResetEmail({ firstName, resetUrl })
  const { error } = await resend.emails.send({
    from:    `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to:      email,
    subject,
    html,
  })
  if (error) return NextResponse.json({ error: 'E-mail versturen mislukt.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
