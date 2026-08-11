import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { getMolliePayment, mapMollieStatus } from '@/lib/payments/mollie'
import { settleOrderPaid } from '@/lib/payments/fulfil'

// POST /api/payments/webhook  — Mollie meldt een statuswijziging (form: id=tr_…).
// We vertrouwen NOOIT de body-status: we halen de betaling zelf bij Mollie op.
// Idempotent; bij een fout geven we 500 zodat Mollie het opnieuw probeert.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let paymentId = ''
  try {
    const body = await req.text()
    paymentId = new URLSearchParams(body).get('id') ?? ''
  } catch { /* geen body */ }
  if (!paymentId) return NextResponse.json({ ok: true })   // niets te doen

  try {
    const payment = await getMolliePayment(paymentId)
    const orderId = typeof payment.metadata?.orderId === 'string' ? payment.metadata.orderId : ''
    if (!isUuid(orderId)) return NextResponse.json({ ok: true })

    const admin = createAdminClient()
    const mapped = mapMollieStatus(payment.status)

    if (mapped === 'paid') {
      await settleOrderPaid(admin, orderId)
    } else if (mapped === 'failed' || mapped === 'expired' || mapped === 'canceled') {
      await admin.from('vh_order')
        .update({ status: mapped, updated_at: new Date().toISOString() })
        .eq('id', orderId).eq('status', 'open')
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[payments] webhook fout:', e)
    return NextResponse.json({ error: 'verwerking mislukt' }, { status: 500 })
  }
}
