/**
 * POST /api/auth/wachtwoord-reset
 *
 * Stuurt een wachtwoord-herstel e-mail. Gebruikt generateLink (recovery) +
 * onze eigen Resend-mail met een link naar /auth/confirm (server-side verifyOtp),
 * net als de medewerker-uitnodiging.
 *
 * Privacy: lekt NIET of een e-mailadres bestaat — antwoordt altijd met ok.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { wachtwoordResetEmail } from '@/lib/email/templates'
import { sendEmail } from '@/lib/email/send'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  // Altijd ok teruggeven (geen account-enumeratie)
  if (!parsed.success) return NextResponse.json({ ok: true })

  const email = parsed.data.email.trim().toLowerCase()
  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''

  try {
    const { data: linkData, error } = await admin.auth.admin.generateLink({
      type:    'recovery',
      email,
      options: { redirectTo: `${appUrl}/auth/wachtwoord-herstellen` },
    })

    // Onbekend e-mailadres of fout → stil ok (geen enumeratie)
    if (error || !linkData?.user) return NextResponse.json({ ok: true })

    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) return NextResponse.json({ ok: true })

    const resetUrl = `${appUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=${encodeURIComponent('/auth/wachtwoord-herstellen')}`

    // Naam ophalen voor de aanhef (optioneel)
    const { data: mw } = await admin
      .from('vh_medewerker').select('name').eq('user_id', linkData.user.id).maybeSingle()
    const firstName = (mw?.name ?? '').split(' ')[0] || 'collega'

    const { subject, html } = wachtwoordResetEmail({ firstName, resetUrl })
    await sendEmail({ to: email, subject, html })
  } catch (e) {
    console.error('[wachtwoord-reset] fout:', e)
    // toch ok teruggeven
  }

  return NextResponse.json({ ok: true })
}
