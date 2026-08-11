import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { getMolliePayment, mapMollieStatus } from '@/lib/payments/mollie'
import { settleOrderPaid } from '@/lib/payments/fulfil'

// GET /api/payments/status?order=<uuid>
// Voor de afrondpagina: bepaalt de order-status. Als hij nog 'open' is maar er is
// een Mollie-betaling, checken we live bij Mollie (de redirect kan vóór de webhook
// aankomen). Bij 'paid' geven we de intake-hervat-URL terug.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get('order') ?? ''
  if (!isUuid(orderId)) return NextResponse.json({ error: 'Ongeldige bestelling.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('vh_order').select('id, status, mollie_payment_id, package_name, amount_cents')
    .eq('id', orderId).maybeSingle()
  if (!order) return NextResponse.json({ error: 'Bestelling niet gevonden.' }, { status: 404 })

  let status = order.status as string

  if (status === 'open' && order.mollie_payment_id) {
    try {
      const payment = await getMolliePayment(order.mollie_payment_id as string)
      const mapped = mapMollieStatus(payment.status)
      if (mapped === 'paid') { status = 'paid' }
      else if (mapped !== 'open') {
        await admin.from('vh_order').update({ status: mapped, updated_at: new Date().toISOString() })
          .eq('id', orderId).eq('status', 'open')
        status = mapped
      }
    } catch (e) { console.error('[payments] status live-check mislukt:', e) }
  }

  let intakeUrl: string | null = null
  if (status === 'paid') {
    try { intakeUrl = (await settleOrderPaid(admin, orderId)).intakeUrl } catch (e) { console.error('[payments] settle mislukt:', e) }
  }

  return NextResponse.json({
    status,
    packageName: order.package_name,
    amountCents: order.amount_cents,
    intakeUrl,
  })
}
