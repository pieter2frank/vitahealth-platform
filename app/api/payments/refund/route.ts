import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { refundOrder } from '@/lib/payments/refund'
import type { AuditAccessBasis } from '@/lib/audit'

// POST /api/payments/refund  { orderId, reason? }
// Medewerker-actie: betaalt een bestelling terug (Mollie), beëindigt het traject
// en genereert een creditfactuur. Alleen voor personeel; idempotent.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function auditRole(role: string): AuditAccessBasis {
  if (role === 'admin') return 'admin'
  if (role === 'arts' || role === 'leefstijlarts') return 'medisch_deskundige'
  return 'medewerker_regulier'
}

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts', 'medewerker'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const reason  = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''
  if (!isUuid(orderId)) return NextResponse.json({ error: 'Ongeldige bestelling.' }, { status: 400 })

  try {
    const admin = createAdminClient()
    const result = await refundOrder(admin, orderId, {
      actorUserId: auth.userId,
      actorRole:   auditRole(auth.role),
      reason:      reason || undefined,
    })
    return NextResponse.json({ ok: true, alreadyDone: result.alreadyDone })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Terugbetalen mislukt.'
    console.error('[payments] refund mislukt:', e)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
