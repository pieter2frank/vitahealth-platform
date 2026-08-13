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

  // Fase 3 PII-kluis: identiteitsvelden gaan uitsluitend naar de kluis; op
  // vh_client zelf resteert alleen het (niet-herleidbare) geslacht.
  const patch: Record<string, string | null> = {}
  const vault: Parameters<typeof upsertIdentity>[2] = {}

  if ('firstName' in b) {
    const v = str(b.firstName, 120)
    if (!v) return NextResponse.json({ error: 'Voornaam is verplicht.' }, { status: 400 })
    vault.firstName = v
  }
  if ('lastName' in b) {
    const v = str(b.lastName, 120)
    if (!v) return NextResponse.json({ error: 'Achternaam is verplicht.' }, { status: 400 })
    vault.lastName = v
  }
  if ('email' in b)      vault.email = str(b.email, 160) || null
  if ('phone' in b)      vault.phone = str(b.phone, 40) || null
  if ('address' in b)    vault.address = str(b.address) || null
  if ('postalCode' in b) vault.postalCode = str(b.postalCode, 16) || null
  if ('city' in b)       vault.city = str(b.city, 120) || null
  if ('gender' in b)     patch.gender = str(b.gender, 20) || null
  // Geboortedatum alleen voor rollen die hem mogen bewerken — server-side afgedwongen.
  if ('birthDate' in b && canSeeBirthDate(auth.role)) {
    vault.birthDate = str(b.birthDate, 10) || null
  }

  if (Object.keys(patch).length === 0 && Object.keys(vault).length === 0) {
    return NextResponse.json({ error: 'Niets te wijzigen.' }, { status: 400 })
  }

  const admin = createAdminClient()
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('vh_client').update(patch).eq('id', id)
    if (error) {
      console.error('[clients] bijwerken mislukt:', error)
      return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
    }
  }

  if (Object.keys(vault).length > 0) {
    try { await upsertIdentity(admin, id, vault) }
    catch (e) {
      console.error('[pii] kluis schrijven mislukt (client update):', e)
      return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
