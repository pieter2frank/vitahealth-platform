import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { priceFor, discountError, type Package, type DiscountCode } from '@/lib/payments/pricing'
import { mollieConfigured } from '@/lib/payments/mollie'
import { PaywallForm } from './PaywallForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Bestellen — Vita Health' }

interface Props {
  params:       Promise<{ slug: string }>
  searchParams: Promise<{ code?: string; email?: string }>
}

export default async function BestellenPage({ params, searchParams }: Props) {
  const { slug } = await params
  const { code, email } = await searchParams

  const admin = createAdminClient()
  const { data: pkg } = await admin
    .from('vh_package')
    .select('id, slug, name, description, price_cents, vat_rate, includes_consult')
    .eq('slug', slug).eq('active', true).maybeSingle()
  // Onbekend/inactief pakket → naar het overzicht met een nette melding.
  if (!pkg) redirect(`/bestellen?onbekend=${encodeURIComponent(slug)}`)

  // Meegegeven kortingscode (bijv. uit een uitnodiging) direct valideren, zodat
  // de klant de korting meteen ziet.
  let dc: DiscountCode | null = null
  let appliedCode = ''
  let resellerName = ''
  if (typeof code === 'string' && code.trim()) {
    const codeStr = code.trim().toUpperCase()
    const { data } = await admin.from('vh_discount_code').select('*').eq('code', codeStr).maybeSingle()
    if (data && !discountError(data as DiscountCode, pkg as Package)) { dc = data as DiscountCode; appliedCode = codeStr }
  }
  // Reseller achter een geldige code (voor de melding op de paywall).
  if (dc?.reseller_id) {
    const { data: r } = await admin.from('vh_reseller').select('name, active').eq('id', dc.reseller_id).maybeSingle()
    if (r?.active) resellerName = r.name as string
  }

  const price = priceFor(pkg as Package, dc)

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] px-4 py-10">
      <div className="w-full max-w-lg">
        <PaywallForm
          pkg={{ slug: pkg.slug, name: pkg.name, description: pkg.description, includesConsult: pkg.includes_consult, vatRate: pkg.vat_rate }}
          initialPrice={price}
          initialCode={appliedCode}
          initialResellerName={resellerName}
          initialEmail={typeof email === 'string' ? email : ''}
          mollieReady={mollieConfigured()}
        />
      </div>
    </main>
  )
}
