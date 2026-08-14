// PII-kluis — veldversleuteling (fase 0). UITSLUITEND server-side gebruiken.
//
// Ontwerp (zie docs/pii-kluis-implementatieplan-v1.0.docx):
//  * AES-256-GCM per veld, willekeurige nonce, versieprefix 'v1:' voor rotatie.
//  * AAD bindt de ciphertext aan (client_id, veldnaam) zodat waarden niet tussen
//    rijen of velden verwisseld kunnen worden.
//  * emailHash: HMAC-SHA256 over het genormaliseerde adres — deterministisch,
//    zodat op e-mail gezocht kan worden zonder het adres leesbaar op te slaan.
//
// Sleutels (elk 32 bytes, base64) staan alleen in de server-env:
//   PII_ENCRYPTION_KEY  — AES-sleutel
//   PII_HASH_KEY        — HMAC-sleutel (bewust een aparte sleutel)
// Verlies van PII_ENCRYPTION_KEY = verlies van de identiteiten; bewaar hem ook
// in de wachtwoordmanager. Nooit in git, de database of NEXT_PUBLIC_*.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto'

const IV_LEN = 12          // GCM-standaard nonce
const TAG_LEN = 16

function parseKey(name: string, raw: string): Buffer {
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error(`${name} moet 32 bytes base64 zijn (nu ${key.length}).`)
  return key
}

function loadKey(name: 'PII_ENCRYPTION_KEY' | 'PII_HASH_KEY'): Buffer {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} ontbreekt in de omgeving.`)
  return parseKey(name, raw)
}

// ── Sleutelrotatie (fase 4) ───────────────────────────────────────────────────
// Versleutelsleutels zijn geversioneerd: `PII_ENCRYPTION_KEY` is versie 1;
// bij rotatie komt er een `PII_ENCRYPTION_KEY_V2` (V3, …) bij. Nieuwe encrypties
// gebruiken automatisch de hoogste aanwezige versie; ontsleutelen kiest de
// sleutel op basis van het versieprefix (`v1:`/`v2:`/…) van het veld. Zolang de
// oude sleutel in de omgeving staat, blijven oude velden leesbaar; de
// rotatie-run (/api/admin/pii-rotate) herversleutelt alles naar de nieuwste.

function encryptionKeyFor(version: number): Buffer {
  if (version === 1) {
    const raw = process.env.PII_ENCRYPTION_KEY_V1 ?? process.env.PII_ENCRYPTION_KEY
    if (!raw) throw new Error('PII_ENCRYPTION_KEY (v1) ontbreekt in de omgeving.')
    return parseKey('PII_ENCRYPTION_KEY (v1)', raw)
  }
  const name = `PII_ENCRYPTION_KEY_V${version}`
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} ontbreekt in de omgeving (nodig om v${version}-velden te ontsleutelen).`)
  return parseKey(name, raw)
}

/** Hoogste aanwezige sleutelversie — hiermee wordt versleuteld. */
export function currentKeyVersion(): number {
  let highest = 1
  for (const name of Object.keys(process.env)) {
    const m = name.match(/^PII_ENCRYPTION_KEY_V(\d+)$/)
    if (m) highest = Math.max(highest, Number(m[1]))
  }
  return highest
}

/**
 * Versleutelt één PII-veld. `aad` is verplicht en bindt de ciphertext aan zijn
 * plek — gebruik `fieldAad(clientId, veldnaam)`. Lege/null waarden blijven null.
 */
export function encryptField(plain: string | null | undefined, aad: string): string | null {
  if (plain === null || plain === undefined || plain === '') return null
  const version = currentKeyVersion()
  const key = encryptionKeyFor(version)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v${version}:${Buffer.concat([iv, tag, ct]).toString('base64')}`
}

/**
 * Ontsleutelt één PII-veld. Gooit bij manipulatie (GCM-tag klopt niet) of bij
 * een verkeerde AAD — dat is gewenst: liever hard falen dan stil verkeerde data.
 */
export function decryptField(stored: string | null | undefined, aad: string): string | null {
  if (stored === null || stored === undefined || stored === '') return null
  const version = fieldKeyVersion(stored)
  if (version === null) throw new Error('Ongeldig kluisveld (geen versieprefix).')
  const buf = Buffer.from(stored.slice(stored.indexOf(':') + 1), 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Ongeldig kluisveld (te kort).')
  const iv  = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct  = buf.subarray(IV_LEN + TAG_LEN)
  const key = encryptionKeyFor(version)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
}

/** Sleutelversie van een opgeslagen kluisveld (null = geen geldig prefix). */
export function fieldKeyVersion(stored: string | null | undefined): number | null {
  if (!stored) return null
  const m = stored.match(/^v(\d+):/)
  return m ? Number(m[1]) : null
}

/** AAD-conventie: bindt een veld aan zijn rij en kolom. */
export function fieldAad(clientId: string, field: string): string {
  return `${clientId}:${field}`
}

/**
 * Deterministische hash van een e-mailadres voor lookups (vervangt ilike).
 * Normaliseert eerst (trim + lowercase) zodat 'Jan@X.nl ' en 'jan@x.nl' matchen.
 */
export function emailHash(email: string): string {
  const key = loadKey('PII_HASH_KEY')
  return createHmac('sha256', key).update(email.trim().toLowerCase(), 'utf8').digest('hex')
}

/** True als de actuele versleutelsleutel en de hash-sleutel aanwezig en geldig zijn. */
export function piiKeysConfigured(): boolean {
  try { encryptionKeyFor(currentKeyVersion()); loadKey('PII_HASH_KEY'); return true } catch { return false }
}
