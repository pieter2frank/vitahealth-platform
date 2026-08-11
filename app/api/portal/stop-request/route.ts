import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'

// POST /api/portal/stop-request  { token, reason? }
// Zelf-service vanuit het klant-statusoverzicht: de klant vraagt om te stoppen.
// Dit betaalt NIET automatisch terug — een medewerker bevestigt en verwerkt de
// restitutie. We markeren alleen de recentste betaalde order als 'stop gevraagd'.
// Geeft altijd { ok: true } terug (geen enumeratie van geldige tokens).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const token  = typeof body.token === 'string' ? body.token.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  if (!token) return NextResponse.json({ ok: true })

  const admin = createAdminClient()

  const { data: tok } = await admin
    .from('vh_intake_token').select('client_id').eq('token', token).maybeSingle()
  const clientId = tok?.client_id as string | null
  if (!clientId) return NextResponse.json({ ok: true })

  // Recentste betaalde, nog niet terugbetaalde order van deze cliënt.
  const { data: order } = await admin
    .from('vh_order')
    .select('id, stop_requested_at')
    .eq('client_id', clientId).eq('status', 'paid')
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(1).maybeSingle()
  if (!order?.id) return NextResponse.json({ ok: true })

  // Idempotent: een lopend verzoek niet overschrijven.
  if (!order.stop_requested_at) {
    await admin.from('vh_order').update({
      stop_requested_at: new Date().toISOString(),
      stop_reason:       reason || null,
      updated_at:        new Date().toISOString(),
    }).eq('id', order.id)
  }

  logAuditEvent({
    actorUserId:     null,
    actorRole:       'portaal_eigen_data',
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'update',
    outcome:         'success',
    reason:          'Stopverzoek ingediend via statusoverzicht',
    metadata:        { order_id: order.id as string },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
