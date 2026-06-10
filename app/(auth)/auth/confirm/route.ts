/**
 * GET /auth/confirm
 *
 * Verifieert een Supabase e-mail-token (invite, recovery, magiclink) SERVER-SIDE
 * via verifyOtp en zet de sessie als cookie. Daarna redirect naar `next`.
 *
 * Nodig omdat invite-links server-side worden gegenereerd: de PKCE-verifier
 * ontbreekt dan in de browser, waardoor de client de sessie niet kan opzetten.
 * Server-side verifyOtp met token_hash heeft die verifier niet nodig.
 */
import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const next = url.searchParams.get('next') ?? '/auth/invite/accept'

  const base = process.env.NEXT_PUBLIC_APP_URL || url.origin

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      return NextResponse.redirect(new URL(next, base))
    }
    console.error('[auth/confirm] verifyOtp fout:', error.message)
  }

  // Token ontbreekt of is ongeldig/verlopen → terug naar de juiste pagina
  const errTarget = new URL(next, base)
  errTarget.searchParams.set('error', 'invalid_link')
  return NextResponse.redirect(errTarget)
}
