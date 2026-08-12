import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { refundOrder } from '@/lib/payments/refund'

// POST /api/payments/refund  { orderId, reason? }
// Admin-actie: betaalt een bestelling terug (Mollie), beëindigt het traject
// en genereert een creditfactuur. Alleen admin; idempotent.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const reason  = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  if (!isUuid(orderId)) return NextResponse.json({ error: 'Ongeldige bestelling.' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const result = await refundOrder(admin, orderId, {
      actorUserId: auth.userId,
      actorRole:   'admin',
      reason:      reason || undefined,
    })
    return NextResponse.json({ ok: true, alreadyDone: result.alreadyDone })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Terugbetalen mislukt.'
    console.error('[payments] refund mislukt:', e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
