import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { upsertIdentity, getIdentities } from '@/lib/pii/identity'
import { piiKeysConfigured } from '@/lib/pii/crypto'

// GET /api/admin/pii-backfill — eenmalige (idempotente) backfill van de PII-kluis
// vanaf de oude vh_client-kolommen, gevolgd door een verificatieronde die de
// kluis ontsleutelt en vergelijkt met de bron. Alleen admin; her-draaien is
// veilig (upsert). In de browser te openen na inloggen.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!piiKeysConfigured()) {
    return NextResponse.json({ error: 'PII-sleutels ontbreken in de omgeving (PII_ENCRYPTION_KEY / PII_HASH_KEY).' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: clients, error } = await admin
    .from('vh_client')
    .select('id, first_name, last_name, email, phone, birth_date, address, postal_code, city')
    .limit(10000)
  if (error) return NextResponse.json({ error: 'Cliënten lezen mislukt.' }, { status: 500 })

  // 1. Backfill (upsert = idempotent).
  let written = 0
  const failures: string[] = []
  for (const c of clients ?? []) {
    try {
      await upsertIdentity(admin, c.id as string, {
        firstName:  (c.first_name as string | null) || null,
        lastName:   (c.last_name as string | null) || null,
        email:      (c.email as string | null) || null,
        phone:      (c.phone as string | null) || null,
        birthDate:  (c.birth_date as string | null) || null,
        address:    (c.address as string | null) || null,
        postalCode: (c.postal_code as string | null) || null,
        city:       (c.city as string | null) || null,
      })
      written++
    } catch (e) {
      console.error('[pii] backfill mislukt voor', c.id, e)
      failures.push(c.id as string)
    }
  }

  // 2. Verificatie: kluis ontsleutelen en vergelijken met de bron.
  const ids = (clients ?? []).map(c => c.id as string)
  const vault = await getIdentities(admin, ids)
  const mismatches: string[] = []
  for (const c of clients ?? []) {
    const v = vault.get(c.id as string)
    const eq = (a: unknown, b: string | null) => ((a as string | null) || null) === (b || null)
    if (!v ||
        !eq(c.first_name, v.firstName) || !eq(c.last_name, v.lastName) ||
        !eq(c.email, v.email)          || !eq(c.phone, v.phone) ||
        !eq(c.birth_date, v.birthDate) || !eq(c.address, v.address) ||
        !eq(c.postal_code, v.postalCode) || !eq(c.city, v.city)) {
      mismatches.push(c.id as string)
    }
  }

  const ok = failures.length === 0 && mismatches.length === 0
  return NextResponse.json({
    ok,
    clients: (clients ?? []).length,
    written,
    vaultRows: vault.size,
    failures,
    mismatches,
    melding: ok
      ? 'Backfill geslaagd en geverifieerd: alle kluisrijen ontsleutelen naar exact de bronwaarden.'
      : 'Er zijn afwijkingen — zie failures/mismatches.',
  })
}
