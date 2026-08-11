import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { priceFor, discountError, type Package, type DiscountCode } from '@/lib/payments/pricing'

// POST /api/payments/discount  { slug, code }
// Valideert een kortingscode en geeft de nieuwe prijsopbouw terug (live preview).
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { slug, code } = await req.json().catch(() => ({}))
  if (typeof slug !== 'string') return NextResponse.json({ error: 'Ongeldig pakket.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: pkg } = await admin
    .from('vh_package')
    .select('id, slug, name, price_cents, vat_rate, includes_consult')
    .eq('slug', slug).eq('active', true).maybeSingle()
  if (!pkg) return NextResponse.json({ error: 'Pakket niet gevonden.' }, { status: 404 })

  const codeStr = typeof code === 'string' ? code.trim().toUpperCase() : ''
  let dc: DiscountCode | null = null
  let codeError: string | null = null
  if (codeStr) {
    const { data } = await admin.from('vh_discount_code').select('*').eq('code', codeStr).maybeSingle()
    dc = (data as DiscountCode | null) ?? null
    codeError = discountError(dc, pkg as Package)
    if (codeError) dc = null
  }

  const price = priceFor(pkg as Package, dc)
  return NextResponse.json({ ok: true, price, codeApplied: Boolean(dc), codeError })
}
