import { toAmountString } from './pricing'

// Dunne wrapper om Mollie's Payments API (REST, geen SDK-dependency). Test- vs
// live-modus zit in de sleutel zelf (test_… / live_…). Server-only.
//
// Env: MOLLIE_API_KEY

const API = 'https://api.mollie.com/v2'
const KEY = process.env.MOLLIE_API_KEY ?? ''

export function mollieConfigured(): boolean {
  return Boolean(KEY)
}

interface MolliePayment {
  id: string
  status: string   // open | paid | canceled | expired | failed | pending | authorized
  _links?: { checkout?: { href: string } }
  metadata?: Record<string, unknown>
}

async function call(path: string, init?: RequestInit): Promise<MolliePayment> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(`Mollie ${res.status}: ${json?.detail ?? JSON.stringify(json).slice(0, 200)}`)
  }
  return json as MolliePayment
}

// Maakt een betaling aan en geeft het id + de gehoste checkout-URL terug.
export async function createMolliePayment(opts: {
  amountCents: number
  description: string
  orderId:     string
  redirectUrl: string
  webhookUrl:  string
}): Promise<{ id: string; checkoutUrl: string }> {
  const p = await call('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount:      { currency: 'EUR', value: toAmountString(opts.amountCents) },
      description: opts.description,
      redirectUrl: opts.redirectUrl,
      webhookUrl:  opts.webhookUrl,
      metadata:    { orderId: opts.orderId },
    }),
  })
  const checkoutUrl = p._links?.checkout?.href
  if (!checkoutUrl) throw new Error('Mollie gaf geen checkout-URL terug.')
  return { id: p.id, checkoutUrl }
}

export async function getMolliePayment(id: string): Promise<MolliePayment> {
  return call(`/payments/${id}`)
}

// Mollie-status → onze order-status.
export function mapMollieStatus(status: string): 'paid' | 'failed' | 'expired' | 'canceled' | 'open' {
  switch (status) {
    case 'paid':      return 'paid'
    case 'failed':    return 'failed'
    case 'expired':   return 'expired'
    case 'canceled':  return 'canceled'
    default:          return 'open'   // open | pending | authorized
  }
}
