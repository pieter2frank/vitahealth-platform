import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { fieldKeyVersion, piiKeysConfigured } from '@/lib/pii/crypto'
import { encryptOrderField } from '@/lib/pii/order'

// GET /api/admin/order-pii-backfill — eenmalige (idempotente) versleuteling van
// de kopergegevens op bestaande bestellingen (fase 5). Rijen die al versleuteld
// zijn worden overgeslagen; lege velden blijven leeg. Alleen admin; in de
// browser te openen na inloggen.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FIELDS = ['email', 'buyer_first_name', 'buyer_last_name', 'buyer_address', 'buyer_postal_code', 'buyer_city'] as const

export async function GET() {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!piiKeysConfigured()) {
    return NextResponse.json({ error: 'PII-sleutels ontbreken in de omgeving.' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('vh_order')
    .select(`id, ${FIELDS.join(', ')}`)
    .limit(10000)
  if (error) return NextResponse.json({ error: 'Bestellingen lezen mislukt.' }, { status: 500 })

  let encrypted = 0, alreadyDone = 0
  const failures: string[] = []

  for (const row of (rows ?? []) as unknown as Record<string, string | null>[]) {
    const id = row.id as string
    const patch: Record<string, string | null> = {}
    for (const f of FIELDS) {
      const v = row[f]
      // Alleen klare, niet-lege waarden zonder versieprefix versleutelen.
      if (v && fieldKeyVersion(v) === null) patch[f] = encryptOrderField(id, f, v)
    }
    if (Object.keys(patch).length === 0) { alreadyDone++; continue }
    const { error: updErr } = await admin.from('vh_order').update(patch).eq('id', id)
    if (updErr) { console.error('[pii] order-backfill mislukt voor', id, updErr); failures.push(id) }
    else encrypted++
  }

  const ok = failures.length === 0
  return NextResponse.json({
    ok,
    bestellingen: (rows ?? []).length,
    versleuteld: encrypted,
    alGedaan: alreadyDone,
    failures,
    melding: ok
      ? 'Alle kopergegevens op bestellingen zijn versleuteld.'
      : 'Er zijn rijen mislukt — zie failures.',
  })
}
