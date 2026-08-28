import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { z } from 'zod'

/**
 * POST /api/portal/enrollment-status  { clientId, to }
 *
 * Server-side statusovergang voor de portal-intake. Vervangt de anonieme
 * client-side updates op vh_client: die faalden stil (RLS → 0 rijen, geen
 * fout), waardoor cliënten met een ingevulde vragenlijst op 'aangemeld'
 * bleven staan. Alleen de twee voorwaartse intake-overgangen zijn mogelijk;
 * een verder gevorderde status wordt nooit teruggezet.
 */
export const dynamic = 'force-dynamic'

const schema = z.object({
  clientId: z.string().uuid(),
  to:       z.enum(['toestemming_gegeven', 'vragenlijst_ingevuld']),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  const { clientId, to } = parsed.data
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('vh_client').select('id, enrollment_status').eq('id', clientId).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })
  const current = client.enrollment_status as string

  // Idempotent: staat de status al op (of voorbij) het doel, dan is er niets te doen.
  if (current === to) return NextResponse.json({ ok: true, status: current })

  let allowed = false
  if (to === 'toestemming_gegeven') {
    allowed = current === 'aangemeld'
  } else if (to === 'vragenlijst_ingevuld') {
    if (current === 'toestemming_gegeven') {
      allowed = true
    } else if (current === 'aangemeld') {
      // Vragenlijst via een losse toewijzing terwijl de statusstap ooit stil
      // faalde: alleen doorzetten als er wél een toestemmingsrecord ligt.
      const { data: consent } = await admin
        .from('vh_consent').select('id').eq('client_id', clientId).limit(1)
      allowed = (consent ?? []).length > 0
    }
  }

  if (!allowed) {
    // Geen fout: een verder gevorderde status (of on-hold) laten we bewust staan.
    return NextResponse.json({ ok: true, status: current, unchanged: true })
  }

  const { error } = await admin
    .from('vh_client').update({ enrollment_status: to }).eq('id', clientId)
  if (error) {
    console.error('[enrollment-status] bijwerken mislukt:', error)
    return NextResponse.json({ error: 'Status bijwerken mislukt.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     null,
    actorRole:       'portaal_eigen_data',
    subjectClientId: clientId,
    resourceType:    'enrollment_status',
    resourceId:      clientId,
    action:          'status_change',
    outcome:         'success',
    reason:          `Aanmeldstatus ${current} → ${to} (portal-intake)`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, status: to })
}
