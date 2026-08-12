// Prijs-, btw- en kortingberekening. Alles in hele centen; prijzen zijn
// INCLUSIEF btw (consumentenprijs), de btw-component rekenen we eruit.

export interface Package {
  id: string; slug: string; name: string
  price_cents: number; vat_rate: number; includes_consult: boolean
}

export interface DiscountCode {
  id: string; code: string; type: 'percent' | 'fixed'; value: number
  package_id: string | null; max_uses: number | null; used_count: number
  valid_until: string | null; active: boolean
  reseller_id?: string | null
}

export interface PriceBreakdown {
  gross_cents:    number   // pakketprijs incl. btw
  discount_cents: number
  amount_cents:   number   // te betalen incl. btw (gross - discount)
  vat_cents:      number   // btw-component van amount
  net_cents:      number   // amount - vat
  vat_rate:       number
}

// Centen → "12.34" (Mollie-formaat, punt als decimaalteken).
export function toAmountString(cents: number): string {
  return (cents / 100).toFixed(2)
}

// "€ 240,00" voor weergave.
export function formatEuro(cents: number): string {
  return '€ ' + (cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Reden waarom een code niet geldig is (null = geldig).
export function discountError(code: DiscountCode | null, pkg: Package): string | null {
  if (!code) return 'Onbekende kortingscode.'
  if (!code.active) return 'Deze kortingscode is niet meer actief.'
  if (code.valid_until && new Date(code.valid_until) < new Date()) return 'Deze kortingscode is verlopen.'
  if (code.max_uses != null && code.used_count >= code.max_uses) return 'Deze kortingscode is al gebruikt.'
  if (code.package_id && code.package_id !== pkg.id) return 'Deze code geldt niet voor dit pakket.'
  return null
}

// Berekent de prijsopbouw voor een pakket met optionele (al gevalideerde) code.
export function priceFor(pkg: Package, code: DiscountCode | null): PriceBreakdown {
  const gross = pkg.price_cents
  let discount = 0
  if (code) {
    discount = code.type === 'percent'
      ? Math.round(gross * Math.min(Math.max(code.value, 0), 100) / 100)
      : Math.min(Math.max(code.value, 0), gross)
  }
  const amount = Math.max(0, gross - discount)
  // btw uit een bruto (incl.) bedrag: btw = bruto − bruto/(1+tarief)
  const vat = Math.round(amount - amount / (1 + pkg.vat_rate / 100))
  return {
    gross_cents:    gross,
    discount_cents: discount,
    amount_cents:   amount,
    vat_cents:      vat,
    net_cents:      amount - vat,
    vat_rate:       pkg.vat_rate,
  }
}
