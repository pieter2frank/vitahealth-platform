import type { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateIntakeToken } from '@/lib/intake-token'
import { issueInvoiceAndEmail } from '@/lib/payments/invoice'
import { upsertIdentity, type IdentityFields } from '@/lib/pii/identity'

type Admin = ReturnType<typeof createAdminClient>

// Verwerkt een betaalde (of €0-)order: koppelt/maakt de cliënt, verbruikt de
// kortingscode, zet de order op 'paid' en levert de intake-hervat-URL op.
// Idempotent: de cliëntkoppeling en code-verbruik gebeuren alleen de eerste keer
// (guard op client_id), zodat webhook + statuscheck elkaar niet dubbel uitvoeren.
export async function settleOrderPaid(admin: Admin, orderId: string): Promise<{ intakeUrl: string | null }> {
  const now = new Date().toISOString()

  const { data: order } = await admin
    .from('vh_order')
    .select('id, status, client_id, email, discount_code, paid_at, buyer_first_name, buyer_last_name, buyer_address, buyer_postal_code, buyer_city')
    .eq('id', orderId).single()
  if (!order) throw new Error('Order niet gevonden.')

  let clientId = order.client_id as string | null

  // Eerste keer: cliënt zoeken op e-mail of aanmaken (leeg naam-veld; de intake
  // vult naam/adres in stap 1-2, net als bij een uitgenodigde cliënt).
  if (!clientId) {
    const email = (order.email as string).trim()
    const { data: existing } = await admin
      .from('vh_client').select('id, first_name, last_name, address, postal_code, city')
      .ilike('email', email).maybeSingle()

    if (existing?.id) {
      clientId = existing.id as string
      // Lege naam/adresvelden bijvullen met de op de paywall opgegeven gegevens
      // (bv. een eerder leeg aangemaakte cliënt of een terugkerende klant zonder
      // deze velden). Bestaande, gevulde gegevens overschrijven we niet.
      const blank = (v: unknown) => !(((v as string | null) ?? '').trim())
      const patch: Record<string, string> = {}
      const vault: IdentityFields = { email }   // e-mail altijd mee → email_hash in de kluis
      if (blank(existing.first_name)  && order.buyer_first_name)  { patch.first_name  = order.buyer_first_name as string;  vault.firstName  = patch.first_name }
      if (blank(existing.last_name)   && order.buyer_last_name)   { patch.last_name   = order.buyer_last_name as string;   vault.lastName   = patch.last_name }
      if (blank(existing.address)     && order.buyer_address)     { patch.address     = order.buyer_address as string;     vault.address    = patch.address }
      if (blank(existing.postal_code) && order.buyer_postal_code) { patch.postal_code = order.buyer_postal_code as string; vault.postalCode = patch.postal_code }
      if (blank(existing.city)        && order.buyer_city)        { patch.city        = order.buyer_city as string;        vault.city       = patch.city }
      if (Object.keys(patch).length) await admin.from('vh_client').update(patch).eq('id', existing.id)
      // Dubbelschrijven naar de PII-kluis (fase 1; oude kolommen blijven leidend).
      try { await upsertIdentity(admin, clientId, vault) }
      catch (e) { console.error('[pii] kluis schrijven mislukt (settle existing):', e) }
    } else {
      // Cliënt aanmaken met de op de paywall opgegeven naam + adres; de intake
      // vult deze voorgevuld aan (en voegt geboortedatum/telefoon/toestemmingen toe).
      const { data: created } = await admin
        .from('vh_client').insert({
          first_name:  (order.buyer_first_name as string | null) ?? '',
          last_name:   (order.buyer_last_name as string | null) ?? '',
          email,
          address:     (order.buyer_address as string | null) ?? null,
          postal_code: (order.buyer_postal_code as string | null) ?? null,
          city:        (order.buyer_city as string | null) ?? null,
        }).select('id').single()
      clientId = (created?.id as string | undefined) ?? null

      // Dubbelschrijven naar de PII-kluis (fase 1; oude kolommen blijven leidend).
      if (clientId) {
        try {
          await upsertIdentity(admin, clientId, {
            firstName:  (order.buyer_first_name as string | null) ?? null,
            lastName:   (order.buyer_last_name as string | null) ?? null,
            email,
            address:    (order.buyer_address as string | null) ?? null,
            postalCode: (order.buyer_postal_code as string | null) ?? null,
            city:       (order.buyer_city as string | null) ?? null,
          })
        } catch (e) { console.error('[pii] kluis schrijven mislukt (settle create):', e) }
      }
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

  // Intake-hervat-link klaarzetten (ook meegestuurd in de factuurmail).
  let intakeUrl: string | null = null
  if (clientId) {
    const token = await getOrCreateIntakeToken(admin, clientId)
    const base = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
    intakeUrl = token ? `${base}/portal/aanmelden?token=${token}` : null
  }

  // Factuur genereren + mailen (met intake-link) — best-effort en idempotent; een
  // fout hier mag de (geldige) betaling en de intake-overdracht nooit blokkeren.
  try { await issueInvoiceAndEmail(admin, orderId, 'invoice', intakeUrl) }
  catch (e) { console.error('[payments] factuur genereren/mailen mislukt:', e) }

  return { intakeUrl }
}
