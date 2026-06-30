import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dagelijkseActiesEmail } from '@/lib/email/templates'
import { isCronAuthorized } from '@/lib/cron'

// Dagelijkse digest met openstaande acties. Wordt aangeroepen door een planner
// (bijv. Vercel Cron) met header `Authorization: Bearer <CRON_SECRET>`.
// Verstuurt alleen een mail als er daadwerkelijk acties openstaan.

export const dynamic = 'force-dynamic'

const resend = new Resend(process.env.RESEND_API_KEY)
const DEFAULT_DIGEST_EMAIL = 'info@dokterchantalle.nl'

export async function GET(req: Request) {
  // Beveiliging: cron-geheim via x-cron-secret of Authorization: Bearer.
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Tellingen van de twee actie-categorieën
  const [{ count: nIntake }, { count: nResults }] = await Promise.all([
    admin.from('vh_client').select('*', { count: 'exact', head: true })
      .eq('enrollment_status', 'vragenlijst_ingevuld'),
    admin.from('vh_client').select('*', { count: 'exact', head: true })
      .eq('enrollment_status', 'uitslag_bekend'),
  ])

  const intake = nIntake ?? 0
  const results = nResults ?? 0

  // Geen openstaande acties → geen mail versturen
  if (intake + results === 0) {
    return NextResponse.json({ ok: true, sent: false, intake, results })
  }

  // Ontvanger uit de instellingen, met fallback naar het standaardadres
  const { data: setting } = await admin
    .from('vh_setting').select('value').eq('key', 'daily_digest_email').maybeSingle()
  const to = setting?.value?.trim() || DEFAULT_DIGEST_EMAIL

  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/dashboard`
    : ''

  const { subject, html } = dagelijkseActiesEmail({ nIntake: intake, nResults: results, dashboardUrl })

  const { error } = await resend.emails.send({
    from: `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
    to,
    subject,
    html,
  })

  if (error) {
    console.error('[cron/dagelijkse-acties] Resend error:', error)
    return NextResponse.json({ error: 'E-mail kon niet worden verzonden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, sent: true, to, intake, results })
}
