import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { intakeHervattingEmail } from '@/lib/email/templates'
import { logAuditEvent } from '@/lib/audit'
import { getOrCreateIntakeToken } from '@/lib/intake-token'
import { sendEmail } from '@/lib/email/send'
import { findClientIdByEmail, getIdentity } from '@/lib/pii/identity'

// POST /api/portal/resume-link  { email }
// Zelf-service: stuurt een veilige hervat-link naar het GEREGISTREERDE adres als
// er een aanmelding met dat e-mailadres bestaat. Geeft altijd { ok: true } terug
// (uniform — onthult nooit of het adres bekend is; geen PII/token in de respons).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}))
  const clean = typeof email === 'string' ? email.trim() : ''
  if (!clean || !clean.includes('@')) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  // Zoeken via de kluis (email_hash) — fase 2: leest niet meer uit de oude kolommen.
  const clientId = await findClientIdByEmail(admin, clean)

  // Onbekend adres → stil, uniforme respons (geen enumeratie).
  if (!clientId) return NextResponse.json({ ok: true })
  const identity = await getIdentity(admin, clientId)
  if (!identity?.email) return NextResponse.json({ ok: true })

  // Intake-token ophalen of aanmaken (het token is de secret voor veilig hervatten).
  const token = await getOrCreateIntakeToken(admin, clientId)
  if (!token) return NextResponse.json({ ok: true })

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const resumeUrl = `${portalUrl}/portal/aanmelden?token=${token}`
  const { subject, html } = intakeHervattingEmail({ firstName: identity.firstName ?? '', vragenlijstUrl: resumeUrl })

  await sendEmail({ to: identity.email, subject, html })

  logAuditEvent({
    actorUserId:     null,
    actorRole:       'portaal_eigen_data',
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'email_sent',
    outcome:         'success',
    reason:          'Zelf-service hervat-link verstuurd',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
