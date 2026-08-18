// PII-kluis fase 5 — kopergegevens op bestellingen (vh_order).
//
// De koper bestaat op het moment van bestellen nog niet als cliënt; de order
// draagt daarom zijn eigen identiteitsvelden (buyer_* + email). Die worden
// vanaf fase 5 met dezelfde veldversleuteling opgeslagen als de kluis, met
// AAD gebonden aan de order (order:<id>:<veld>).
//
// Overgangstolerantie: bestaande rijen bevatten nog klare tekst. Lezen valt
// daarom terug op de opgeslagen waarde als er geen versieprefix (v1:, v2:, …)
// op staat; de eenmalige backfill (/api/admin/order-pii-backfill) versleutelt
// de rest. UITSLUITEND server-side gebruiken.

import { encryptField, decryptField, fieldKeyVersion } from './crypto'

export interface OrderBuyer {
  email:      string
  firstName:  string | null
  lastName:   string | null
  address:    string | null
  postalCode: string | null
  city:       string | null
}

const orderAad = (orderId: string, field: string) => `order:${orderId}:${field}`

export function encryptOrderField(orderId: string, field: string, value: string | null): string | null {
  return encryptField(value, orderAad(orderId, field))
}

/** Leest een orderveld: versleuteld → ontsleutelen; anders (legacy) de klare waarde. */
export function decryptOrderField(orderId: string, field: string, stored: string | null | undefined): string | null {
  if (stored === null || stored === undefined || stored === '') return (stored as '' | null | undefined) === '' ? '' : null
  if (fieldKeyVersion(stored) === null) return stored   // legacy klare tekst (pre-fase-5)
  return decryptField(stored, orderAad(orderId, field))
}

/** Kolommenmap voor insert/update: alle kopervelden versleuteld. */
export function encryptOrderBuyer(orderId: string, b: OrderBuyer): Record<string, string | null> {
  return {
    email:             encryptOrderField(orderId, 'email', b.email) ?? '',
    buyer_first_name:  encryptOrderField(orderId, 'buyer_first_name', b.firstName),
    buyer_last_name:   encryptOrderField(orderId, 'buyer_last_name', b.lastName),
    buyer_address:     encryptOrderField(orderId, 'buyer_address', b.address),
    buyer_postal_code: encryptOrderField(orderId, 'buyer_postal_code', b.postalCode),
    buyer_city:        encryptOrderField(orderId, 'buyer_city', b.city),
  }
}

/** Ontsleutelt de kopervelden van een order-rij (snake_case in, klare velden uit). */
export function decryptOrderBuyer(row: {
  id: string
  email?: string | null
  buyer_first_name?: string | null
  buyer_last_name?: string | null
  buyer_address?: string | null
  buyer_postal_code?: string | null
  buyer_city?: string | null
}): OrderBuyer {
  const d = (field: string, v: string | null | undefined) => decryptOrderField(row.id, field, v)
  return {
    email:      d('email', row.email) ?? '',
    firstName:  d('buyer_first_name', row.buyer_first_name),
    lastName:   d('buyer_last_name', row.buyer_last_name),
    address:    d('buyer_address', row.buyer_address),
    postalCode: d('buyer_postal_code', row.buyer_postal_code),
    city:       d('buyer_city', row.buyer_city),
  }
}
