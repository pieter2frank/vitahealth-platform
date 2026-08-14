import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { getIdentity, upsertIdentity } from '@/lib/pii/identity'
import { currentKeyVersion, fieldKeyVersion, piiKeysConfigured } from '@/lib/pii/crypto'
import { logAuditEvent } from '@/lib/audit'

// GET /api/admin/pii-rotate — sleutelrotatie-run (idempotent). Alleen admin.
//
// Herversleutelt alle kluisrijen naar de nieuwste sleutelversie. Procedure:
//  1. genereer een nieuwe sleutel en zet hem als PII_ENCRYPTION_KEY_V<n+1> in de
//     omgeving (de oude versie(s) laten staan!), redeploy;
//  2. open deze route als admin → alle rijen worden herversleuteld;
//  3. controleer remaining=0 en verwijder daarna pas de oude sleutel uit de env.
// Zie docs/pii-sleutelbeheer-retentie-v1.0.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENC_COLS = [
  'first_name_enc', 'last_name_enc', 'email_enc', 'phone_enc',
  'birth_date_enc', 'address_enc', 'postal_code_enc', 'city_enc',
] as const

export async function GET() {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!piiKeysConfigured()) {
    return NextResponse.json({ error: 'PII-sleutels ontbreken of zijn ongeldig in de omgeving.' }, { status: 503 })
  }

  const target = currentKeyVersion()
  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('vh_client_identity')
    .select(`client_id, ${ENC_COLS.join(', ')}`)
    .limit(10000)
  if (error) return NextResponse.json({ error: 'Kluis lezen mislukt.' }, { status: 500 })

  let rotated = 0, alreadyCurrent = 0
  const failures: string[] = []

  for (const row of (rows ?? []) as unknown as Record<string, string | null>[]) {
    const clientId = row.client_id as string
    // Oudste versie in deze rij bepaalt of er iets te roteren valt.
    const versions = ENC_COLS
      .map(c => fieldKeyVersion(row[c]))
      .filter((v): v is number => v !== null)
    if (versions.length === 0 || Math.min(...versions) >= target) { alreadyCurrent++; continue }

    try {
      // Ontsleutelen (kiest per veld automatisch de juiste oude sleutel) en
      // integraal herschrijven — encryptField gebruikt de nieuwste versie.
      const identity = await getIdentity(admin, clientId)
      if (!identity) { alreadyCurrent++; continue }
      await upsertIdentity(admin, clientId, {
        firstName:  identity.firstName,  lastName:   identity.lastName,
        email:      identity.email,      phone:      identity.phone,
        birthDate:  identity.birthDate,  address:    identity.address,
        postalCode: identity.postalCode, city:       identity.city,
      })
      rotated++
    } catch (e) {
      console.error('[pii] rotatie mislukt voor', clientId, e)
      failures.push(clientId)
    }
  }

  await logAuditEvent({
    actorUserId: auth.userId, actorRole: 'admin',
    resourceType: 'client', action: 'update', outcome: failures.length ? 'failed' : 'success',
    reason: 'PII-sleutelrotatie-run',
    metadata: { target_version: target, rotated, already_current: alreadyCurrent, failures: failures.length },
  })

  return NextResponse.json({
    ok: failures.length === 0,
    doelversie: `v${target}`,
    rijen: (rows ?? []).length,
    geroteerd: rotated,
    alActueel: alreadyCurrent,
    remaining: failures.length,
    failures,
    melding: failures.length === 0
      ? `Alle kluisrijen staan op v${target}. Oude sleutel(s) kunnen uit de omgeving worden verwijderd.`
      : 'Er zijn rijen mislukt — oude sleutels NIET verwijderen; zie failures.',
  })
}
