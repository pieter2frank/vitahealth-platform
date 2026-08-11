import type { createAdminClient } from '@/lib/supabase/admin'
import { createMollieRefund } from '@/lib/payments/mollie'
import { issueInvoiceAndEmail } from '@/lib/payments/invoice'
import { logAuditEvent, type AuditAccessBasis } from '@/lib/audit'

type Admin = ReturnType<typeof createAdminClient>

export type RefundResult =
  | { status: 'refunded'; alreadyDone: false }
  | { status: 'refunded'; alreadyDone: true }

// Betaalt een order terug en beëindigt het traject.
//  1. Restitutie bij Mollie (overgeslagen bij een €0-order, bv. 100%-kortingscode).
//  2. Order op 'refunded' met tijdstip + refund-id + reden.
//  3. Cliënt-traject op 'geannuleerd' (terminaal).
//  4. Creditfactuur genereren + mailen (best-effort, blokkeert de restitutie niet).
// Idempotent: een al terugbetaalde order levert direct alreadyDone terug.
export async function refundOrder(
  admin: Admin,
  orderId: string,
  opts: { actorUserId: string | null; actorRole: AuditAccessBasis; reason?: string },
): Promise<RefundResult> {
  const now = new Date().toISOString()

  const { data: order } = await admin
    .from('vh_order')
    .select('id, status, mollie_payment_id, amount_cents, client_id')
    .eq('id', orderId).single()
  if (!order) throw new Error('Bestelling niet gevonden.')

  if (order.status === 'refunded') return { status: 'refunded', alreadyDone: true }
  if (order.status !== 'paid') throw new Error('Alleen een betaalde bestelling kan worden terugbetaald.')

  const amount = (order.amount_cents as number) ?? 0
  let refundId: string | null = null

  if (amount > 0) {
    const paymentId = order.mollie_payment_id as string | null
    if (!paymentId) throw new Error('Geen Mollie-betaling gekoppeld — terugbetalen niet mogelijk.')
    const refund = await createMollieRefund(paymentId, amount, `Terugbetaling bestelling ${orderId}`)
    refundId = refund.id
  }

  await admin.from('vh_order').update({
    status: 'refunded',
    refunded_at: now,
    mollie_refund_id: refundId,
    refund_reason: opts.reason ?? null,
    updated_at: now,
  }).eq('id', orderId)

  const clientId = order.client_id as string | null
  if (clientId) {
    await admin.from('vh_client').update({ enrollment_status: 'geannuleerd' }).eq('id', clientId)
  }

  // Creditfactuur — best-effort; een fout hier mag de (geslaagde) restitutie niet blokkeren.
  try { await issueInvoiceAndEmail(admin, orderId, 'credit') }
  catch (e) { console.error('[payments] creditfactuur genereren/mailen mislukt:', e) }

  await logAuditEvent({
    actorUserId:     opts.actorUserId,
    actorRole:       opts.actorRole,
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'status_change',
    reason:          'restitutie — traject beëindigd',
    outcome:         'success',
    metadata:        { order_id: orderId, mollie_refund_id: refundId, amount_cents: amount },
  })

  return { status: 'refunded', alreadyDone: false }
}
