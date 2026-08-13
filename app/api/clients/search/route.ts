import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { getIdentities, getIdentity } from '@/lib/pii/identity'

// GET /api/clients/search?q=<term>  → [{ id, name, email }] (max 8)
// GET /api/clients/search?id=<uuid> → [{ id, name, email }]
// Cliënten zoeken op naam/e-mail voor medewerkersflows (kit-toewijzing e.d.).
// Fase 2 PII-kluis: de browser kan niet meer zelf op naam zoeken (ilike op de
// oude kolommen); het zoeken gebeurt hier server-side na ontsleuteling.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts', 'medewerker'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(req.url)
  const admin = createAdminClient()

  // Losse naam-lookup op id (voor "toegewezen aan …"-weergave).
  const id = url.searchParams.get('id') ?? ''
  if (id) {
    if (!isUuid(id)) return NextResponse.json({ results: [] })
    const idn = await getIdentity(admin, id)
    return NextResponse.json({
      results: idn ? [{ id, name: `${idn.firstName ?? ''} ${idn.lastName ?? ''}`.trim(), email: idn.email }] : [],
    })
  }

  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  if (q.length < 2) return NextResponse.json({ results: [] })

  // Zoeken in de app-laag: alle cliënt-ids ophalen en de kluis batch-ontsleutelen.
  // Bij de huidige aantallen ruim snel genoeg; bij groei kan hier een
  // geïndexeerde zoekstructuur komen.
  const { data: rows } = await admin.from('vh_client').select('id').limit(5000)
  const identities = await getIdentities(admin, (rows ?? []).map(r => r.id as string))

  const results = [...identities.values()]
    .filter(i =>
      (i.firstName ?? '').toLowerCase().includes(q) ||
      (i.lastName ?? '').toLowerCase().includes(q) ||
      (i.email ?? '').toLowerCase().includes(q))
    .slice(0, 8)
    .map(i => ({ id: i.clientId, name: `${i.firstName ?? ''} ${i.lastName ?? ''}`.trim(), email: i.email }))

  return NextResponse.json({ results })
}
