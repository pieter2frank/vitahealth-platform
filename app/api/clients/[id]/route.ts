import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { canSeeBirthDate } from '@/lib/auth/roles'
import { isUuid } from '@/lib/validation'
import { upsertIdentity } from '@/lib/pii/identity'

// PATCH /api/clients/[id] — cliëntgegevens bewerken (medewerkersportaal).
// Dubbelschrijft naar de oude kolommen (nog leidend) én de PII-kluis.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts', 'medewerker'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige cliënt.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const patch: Record<string, string | null> = {}
  const vault: Parameters<typeof upsertIdentity>[2] = {}

  if ('firstName' in b) {
    const v = str(b.firstName, 120)
    if (!v) return NextResponse.json({ error: 'Voornaam is verplicht.' }, { status: 400 })
    patch.first_name = v; vault.firstName = v
  }
  if ('lastName' in b) {
    const v = str(b.lastName, 120)
    if (!v) return NextResponse.json({ error: 'Achternaam is verplicht.' }, { status: 400 })
    patch.last_name = v; vault.lastName = v
  }
  if ('email' in b)      { patch.email = str(b.email, 160) || null;      vault.email = patch.email }
  if ('phone' in b)      { patch.phone = str(b.phone, 40) || null;       vault.phone = patch.phone }
  if ('address' in b)    { patch.address = str(b.address) || null;       vault.address = patch.address }
  if ('postalCode' in b) { patch.postal_code = str(b.postalCode, 16) || null; vault.postalCode = patch.postal_code }
  if ('city' in b)       { patch.city = str(b.city, 120) || null;        vault.city = patch.city }
  if ('gender' in b)     { patch.gender = str(b.gender, 20) || null }    // geen kluisveld
  // Geboortedatum alleen voor rollen die hem mogen bewerken — server-side afgedwongen.
  if ('birthDate' in b && canSeeBirthDate(auth.role)) {
    patch.birth_date = str(b.birthDate, 10) || null; vault.birthDate = patch.birth_date
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Niets te wijzigen.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_client').update(patch).eq('id', id)
  if (error) {
    console.error('[clients] bijwerken mislukt:', error)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  if (Object.keys(vault).length > 0) {
    try { await upsertIdentity(admin, id, vault) }
    catch (e) { console.error('[pii] kluis schrijven mislukt (client update):', e) }
  }

  return NextResponse.json({ ok: true })
}
