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

const VERSION = 'v1'
const IV_LEN = 12          // GCM-standaard nonce
const TAG_LEN = 16

function loadKey(name: 'PII_ENCRYPTION_KEY' | 'PII_HASH_KEY'): Buffer {
  const raw = process.env[name]
  if (!raw) throw new Error(`${name} ontbreekt in de omgeving.`)
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error(`${name} moet 32 bytes base64 zijn (nu ${key.length}).`)
  return key
}

/**
 * Versleutelt één PII-veld. `aad` is verplicht en bindt de ciphertext aan zijn
 * plek — gebruik `fieldAad(clientId, veldnaam)`. Lege/null waarden blijven null.
 */
export function encryptField(plain: string | null | undefined, aad: string): string | null {
  if (plain === null || plain === undefined || plain === '') return null
  const key = loadKey('PII_ENCRYPTION_KEY')
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${VERSION}:${Buffer.concat([iv, tag, ct]).toString('base64')}`
}

/**
 * Ontsleutelt één PII-veld. Gooit bij manipulatie (GCM-tag klopt niet) of bij
 * een verkeerde AAD — dat is gewenst: liever hard falen dan stil verkeerde data.
 */
export function decryptField(stored: string | null | undefined, aad: string): string | null {
  if (stored === null || stored === undefined || stored === '') return null
  const sep = stored.indexOf(':')
  if (sep === -1) throw new Error('Ongeldig kluisveld (geen versieprefix).')
  const version = stored.slice(0, sep)
  if (version !== VERSION) throw new Error(`Onbekende kluisversie '${version}'.`)
  const buf = Buffer.from(stored.slice(sep + 1), 'base64')
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error('Ongeldig kluisveld (te kort).')
  const iv  = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct  = buf.subarray(IV_LEN + TAG_LEN)
  const key = loadKey('PII_ENCRYPTION_KEY')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
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

/** True als beide sleutels aanwezig en geldig zijn (voor health checks). */
export function piiKeysConfigured(): boolean {
  try { loadKey('PII_ENCRYPTION_KEY'); loadKey('PII_HASH_KEY'); return true } catch { return false }
}
