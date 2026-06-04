import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TIMEOUT_AFTER  = 3   // mislukte pogingen → tijdelijke blokkade
const BLOCK_AFTER    = 6   // mislukte pogingen → permanente blokkade
const TIMEOUT_MINS   = 5   // minuten timeout

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail en wachtwoord zijn verplicht.' }, { status: 400 })
  }

  const normalEmail = email.trim().toLowerCase()
  const admin       = createAdminClient()

  // ── 1. Huidige status ophalen ────────────────────────────────────────────────
  const { data: attempt } = await admin
    .from('vh_login_attempt')
    .select('attempts, locked_until, blocked')
    .eq('email', normalEmail)
    .maybeSingle()

  // Permanent geblokkeerd
  if (attempt?.blocked) {
    return NextResponse.json({
      error: 'Dit account is geblokkeerd na te veel mislukte inlogpogingen. Neem contact op met de beheerder.',
      blocked: true,
    }, { status: 403 })
  }

  // Tijdelijk geblokkeerd
  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    const secsLeft = Math.ceil((new Date(attempt.locked_until).getTime() - Date.now()) / 1000)
    const minsLeft = Math.ceil(secsLeft / 60)
    return NextResponse.json({
      error: `Te veel mislukte pogingen. Probeer het over ${minsLeft} ${minsLeft === 1 ? 'minuut' : 'minuten'} opnieuw.`,
      lockedUntil: attempt.locked_until,
    }, { status: 429 })
  }

  // ── 2. Inlogpoging via Supabase ──────────────────────────────────────────────
  const supabase   = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalEmail, password })

  if (!signInError) {
    // Succes — teller resetten
    await admin.from('vh_login_attempt').upsert({
      email:           normalEmail,
      attempts:        0,
      blocked:         false,
      locked_until:    null,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    return NextResponse.json({ ok: true })
  }

  // ── 3. Mislukking — teller ophogen ──────────────────────────────────────────
  const prevAttempts  = attempt?.attempts ?? 0
  const newAttempts   = prevAttempts + 1
  const nowBlocked    = newAttempts >= BLOCK_AFTER
  const nowLocked     = !nowBlocked && newAttempts >= TIMEOUT_AFTER
  const lockedUntil   = nowLocked
    ? new Date(Date.now() + TIMEOUT_MINS * 60 * 1000).toISOString()
    : null

  await admin.from('vh_login_attempt').upsert({
    email:           normalEmail,
    attempts:        newAttempts,
    blocked:         nowBlocked,
    locked_until:    lockedUntil,
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: 'email' })

  if (nowBlocked) {
    return NextResponse.json({
      error: 'Dit account is nu geblokkeerd na te veel mislukte pogingen. Neem contact op met de beheerder.',
      blocked: true,
    }, { status: 403 })
  }

  if (nowLocked) {
    return NextResponse.json({
      error: `Te veel mislukte pogingen. Probeer het over ${TIMEOUT_MINS} minuten opnieuw.`,
      lockedUntil,
    }, { status: 429 })
  }

  const remaining = TIMEOUT_AFTER - newAttempts
  return NextResponse.json({
    error: remaining > 0
      ? `Onjuist e-mailadres of wachtwoord. Nog ${remaining} ${remaining === 1 ? 'poging' : 'pogingen'} voordat het account tijdelijk wordt geblokkeerd.`
      : 'Onjuist e-mailadres of wachtwoord.',
  }, { status: 401 })
}
