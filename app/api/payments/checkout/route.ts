import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { priceFor, discountError, type Package, type DiscountCode } from '@/lib/payments/pricing'
import { createMolliePayment, mollieConfigured } from '@/lib/payments/mollie'
import { settleOrderPaid } from '@/lib/payments/fulfil'

// POST /api/payments/checkout  { slug, email, code? }
// Maakt een order aan en start de Mollie-betaling (of vervult direct bij €0).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { slug, email, code } = body
  if (typeof slug !== 'string') return NextResponse.json({ error: 'Ongeldig pakket.' }, { status: 400 })
  if (typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'Voer een geldig e-mailadres in.' }, { status: 400 })
  }

  // Factuur-/klantgegevens (verplicht voor een complete factuur + kitverzending).
  const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const firstName  = str(body.firstName)
  const lastName   = str(body.lastName)
  const address    = str(body.address, 200)
  const postalCode = str(body.postalCode, 16)
  const city       = str(body.city)
  if (!firstName || !lastName || !address || !postalCode || !city) {
    return NextResponse.json({ error: 'Vul je naam en adresgegevens volledig in.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: pkg } = await admin
    .from('vh_package')
    .select('id, slug, name, price_cents, vat_rate, includes_consult')
    .eq('slug', slug).eq('active', true).maybeSingle()
  if (!pkg) return NextResponse.json({ error: 'Pakket niet gevonden.' }, { status: 404 })

  const codeStr = typeof code === 'string' ? code.trim().toUpperCase() : ''
  let dc: DiscountCode | null = null
  if (codeStr) {
    const { data } = await admin.from('vh_discount_code').select('*').eq('code', codeStr).maybeSingle()
    dc = (data as DiscountCode | null) ?? null
    if (discountError(dc, pkg as Package)) {
      return NextResponse.json({ error: discountError(dc, pkg as Package) }, { status: 400 })
    }
  }

  const price = priceFor(pkg as Package, dc)

  const { data: order, error } = await admin.from('vh_order').insert({
    package_id:      pkg.id,
    package_name:    pkg.name,
    email:           email.trim(),
    buyer_first_name: firstName,
    buyer_last_name:  lastName,
    buyer_address:    address,
    buyer_postal_code: postalCode,
    buyer_city:       city,
    amount_cents:    price.amount_cents,
    vat_cents:       price.vat_cents,
    vat_rate:        price.vat_rate,
    discount_code:   dc ? dc.code : null,
    discount_cents:  price.discount_cents,
  }).select('id').single()
  if (error || !order) {
    console.error('[payments] order aanmaken mislukt:', error)
    return NextResponse.json({ error: 'Bestelling aanmaken mislukt.' }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_PLATFORM_URL ?? new URL(req.url).origin
  const afronden = `${base}/bestellen/afronden?order=${order.id}`

  // €0 (bijv. 100%-code): Mollie overslaan, direct vervullen.
  if (price.amount_cents === 0) {
    try { await settleOrderPaid(admin, order.id as string) } catch (e) { console.error('[payments] gratis order vervullen mislukt:', e) }
    return NextResponse.json({ ok: true, free: true, redirectUrl: afronden })
  }

  if (!mollieConfigured()) {
    return NextResponse.json({ error: 'Betalen is nog niet geconfigureerd (MOLLIE_API_KEY ontbreekt).' }, { status: 503 })
  }

  try {
    const { id, checkoutUrl } = await createMolliePayment({
      amountCents: price.amount_cents,
      description: pkg.name,
      orderId:     order.id as string,
      redirectUrl: afronden,
      webhookUrl:  `${base}/api/payments/webhook`,
    })
    await admin.from('vh_order').update({ mollie_payment_id: id, updated_at: new Date().toISOString() }).eq('id', order.id)
    return NextResponse.json({ ok: true, checkoutUrl })
  } catch (e) {
    console.error('[payments] Mollie-betaling mislukt:', e)
    return NextResponse.json({ error: 'De betaling kon niet worden gestart. Probeer het later opnieuw.' }, { status: 502 })
  }
}
