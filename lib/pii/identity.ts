// PII-kluis — toegangslaag (fase 0). UITSLUITEND server-side, via de admin-client.
//
// Dit is de ENIGE plek die vh_client_identity leest/schrijft. Alle andere code
// werkt met klare velden en weet niets van de versleuteling. Zie
// docs/pii-kluis-implementatieplan-v1.0.docx.

import type { createAdminClient } from '@/lib/supabase/admin'
import { encryptField, decryptField, fieldAad, emailHash } from './crypto'

type Admin = ReturnType<typeof createAdminClient>

/** Klare (ontsleutelde) identiteit van een cliënt. */
export interface ClientIdentity {
  clientId:   string
  firstName:  string | null
  lastName:   string | null
  email:      string | null
  phone:      string | null
  birthDate:  string | null   // 'YYYY-MM-DD'
  address:    string | null
  postalCode: string | null
  city:       string | null
}

/** Deel-update: alleen meegegeven velden worden geschreven. */
export type IdentityFields = Partial<Omit<ClientIdentity, 'clientId'>>

// Kolom ↔ veld-mapping (kolomnaam in de kluis, veldnaam in de AAD).
const COLS = [
  ['first_name_enc',  'first_name',  'firstName'],
  ['last_name_enc',   'last_name',   'lastName'],
  ['email_enc',       'email',       'email'],
  ['phone_enc',       'phone',       'phone'],
  ['birth_date_enc',  'birth_date',  'birthDate'],
  ['address_enc',     'address',     'address'],
  ['postal_code_enc', 'postal_code', 'postalCode'],
  ['city_enc',        'city',        'city'],
] as const

const SELECT = `client_id, ${COLS.map(c => c[0]).join(', ')}`

function decryptRow(row: Record<string, unknown>): ClientIdentity {
  const clientId = row.client_id as string
  const out = { clientId } as ClientIdentity
  for (const [col, aadName, field] of COLS) {
    out[field] = decryptField(row[col] as string | null, fieldAad(clientId, aadName))
  }
  return out
}

/** Identiteit van één cliënt (null als er geen kluisrij is). */
export async function getIdentity(admin: Admin, clientId: string): Promise<ClientIdentity | null> {
  const { data } = await admin
    .from('vh_client_identity').select(SELECT).eq('client_id', clientId).maybeSingle()
  return data ? decryptRow(data as unknown as Record<string, unknown>) : null
}

/**
 * Identiteiten van meerdere cliënten in één query (voor lijsten/exports).
 * Geeft een Map client_id → identiteit; ontbrekende kluisrijen ontbreken in de map.
 */
export async function getIdentities(admin: Admin, clientIds: string[]): Promise<Map<string, ClientIdentity>> {
  const map = new Map<string, ClientIdentity>()
  if (clientIds.length === 0) return map
  const { data } = await admin
    .from('vh_client_identity').select(SELECT).in('client_id', clientIds)
  for (const row of data ?? []) {
    const id = decryptRow(row as unknown as Record<string, unknown>)
    map.set(id.clientId, id)
  }
  return map
}

/**
 * Zoekt een cliënt op e-mailadres via de deterministische hash (vervangt ilike).
 * Bij meerdere treffers wint de recentst aangemaakte kluisrij.
 */
export async function findClientIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const clean = email.trim()
  if (!clean) return null
  const { data } = await admin
    .from('vh_client_identity')
    .select('client_id')
    .eq('email_hash', emailHash(clean))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.client_id as string | undefined) ?? null
}

/**
 * Pseudoniem dossier + ontsleutelde identiteit, samengevoegd in de oude
 * (snake_case) vorm van vh_client. Handig als drop-in vervanger van een
 * `select('id, first_name, …')` op vh_client (fase 2): de aanroeper hoeft
 * alleen de query te vervangen, niet de veldnamen.
 */
export interface ClientRecord {
  id: string; subject_ref: string; gender: string | null
  enrollment_status: string | null; created_at: string
  first_name: string; last_name: string
  email: string | null; phone: string | null; birth_date: string | null
  address: string | null; postal_code: string | null; city: string | null
}

export async function getClientRecord(admin: Admin, clientId: string): Promise<ClientRecord | null> {
  const [{ data: c }, identity] = await Promise.all([
    admin.from('vh_client')
      .select('id, subject_ref, gender, enrollment_status, created_at')
      .eq('id', clientId).maybeSingle(),
    getIdentity(admin, clientId),
  ])
  if (!c) return null
  return {
    id: c.id as string,
    subject_ref:       (c.subject_ref as string | null) ?? '',
    gender:            (c.gender as string | null) ?? null,
    enrollment_status: (c.enrollment_status as string | null) ?? null,
    created_at:        (c.created_at as string | null) ?? '',
    first_name:  identity?.firstName ?? '',
    last_name:   identity?.lastName ?? '',
    email:       identity?.email ?? null,
    phone:       identity?.phone ?? null,
    birth_date:  identity?.birthDate ?? null,
    address:     identity?.address ?? null,
    postal_code: identity?.postalCode ?? null,
    city:        identity?.city ?? null,
  }
}

/**
 * Schrijft (versleuteld) identiteitsvelden voor een cliënt; maakt de kluisrij
 * aan als die nog niet bestaat. Alleen meegegeven velden worden geraakt;
 * een expliciete null wist het veld. Bij e-mail wordt ook email_hash gezet.
 */
export async function upsertIdentity(admin: Admin, clientId: string, fields: IdentityFields): Promise<void> {
  const patch: Record<string, string | null> = {}
  for (const [col, aadName, field] of COLS) {
    if (!(field in fields)) continue
    patch[col] = encryptField(fields[field] ?? null, fieldAad(clientId, aadName))
  }
  if ('email' in fields) {
    const email = fields.email ?? ''
    patch.email_hash = email.trim() ? emailHash(email) : null
  }
  if (Object.keys(patch).length === 0) return

  const { error } = await admin
    .from('vh_client_identity')
    .upsert({ client_id: clientId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
  if (error) throw new Error(`Kluis schrijven mislukt: ${error.message}`)
}
