import type { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateIntakeToken } from '@/lib/intake-token'
import { issueInvoiceAndEmail } from '@/lib/payments/invoice'

type Admin = ReturnType<typeof createAdminClient>

// Verwerkt een betaalde (of €0-)order: koppelt/maakt de cliënt, verbruikt de
// kortingscode, zet de order op 'paid' en levert de intake-hervat-URL op.
// Idempotent: de cliëntkoppeling en code-verbruik gebeuren alleen de eerste keer
// (guard op client_id), zodat webhook + statuscheck elkaar niet dubbel uitvoeren.
export async function settleOrderPaid(admin: Admin, orderId: string): Promise<{ intakeUrl: string | null }> {
  const now = new Date().toISOString()

  const { data: order } = await admin
    .from('vh_order')
    .select('id, status, client_id, email, discount_code, paid_at')
    .eq('id', orderId).single()
  if (!order) throw new Error('Order niet gevonden.')

  let clientId = order.client_id as string | null

  // Eerste keer: cliënt zoeken op e-mail of aanmaken (leeg naam-veld; de intake
  // vult naam/adres in stap 1-2, net als bij een uitgenodigde cliënt).
  if (!clientId) {
    const email = (order.email as string).trim()
    const { data: existing } = await admin
      .from('vh_client').select('id').ilike('email', email).maybeSingle()

    if (existing?.id) {
      clientId = existing.id as string
    } else {
      const { data: created } = await admin
        .from('vh_client').insert({ first_name: '', last_name: '', email }).select('id').single()
      clientId = (created?.id as string | undefined) ?? null
    }

    if (clientId) {
      await admin.from('vh_order').update({ client_id: clientId, updated_at: now }).eq('id', orderId)

      // Kortingscode verbruiken (bij daadwerkelijke betaling, niet bij afhaken).
      if (order.discount_code) {
        const { data: dc } = await admin
          .from('vh_discount_code').select('id, used_count')
          .eq('code', (order.discount_code as string)).maybeSingle()
        if (dc) {
          await admin.from('vh_discount_code')
            .update({ used_count: ((dc.used_count as number) ?? 0) + 1 }).eq('id', dc.id)
        }
      }
    }
  }

  // Status op 'paid' zetten (indien nog niet).
  if (order.status !== 'paid') {
    await admin.from('vh_order')
      .update({ status: 'paid', paid_at: order.paid_at ?? now, updated_at: now })
      .eq('id', orderId)
  }

  // Factuur genereren + mailen — best-effort en idempotent; een fout hier mag de
  // (geldige) betaling en de intake-overdracht nooit blokkeren.
  try { await issueInvoiceAndEmail(admin, orderId, 'invoice') }
  catch (e) { console.error('[payments] factuur genereren/mailen mislukt:', e) }

  if (!clientId) return { intakeUrl: null }

  const token = await getOrCreateIntakeToken(admin, clientId)
  const base = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  return { intakeUrl: token ? `${base}/portal/aanmelden?token=${token}` : null }
}
