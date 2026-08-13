import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { upsertIdentity } from '@/lib/pii/identity'

// POST /api/clients — cliënt aanmaken (medewerkersportaal: nieuw, uitnodigen,
// aanvraag-bevestigen). Vanaf fase 1 van de PII-kluis lopen cliënt-writes via de
// server: dubbelschrijven naar de oude kolommen (nog leidend) én de kluis.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts', 'medewerker'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const firstName = str(b.firstName, 120)
  const lastName  = str(b.lastName, 120)
  if (!firstName || !lastName) return NextResponse.json({ error: 'Voor- en achternaam zijn verplicht.' }, { status: 400 })

  const email     = str(b.email, 160)
  const phone     = str(b.phone, 40)
  // Bij AANMAKEN mag de geboortedatum mee voor alle rollen: hij komt dan uit de
  // brondata (bv. een arbo-aanvraag), niet uit handmatige invoer. De
  // canSeeBirthDate-beperking geldt bij bewerken (PATCH /api/clients/[id]).
  const birthDate = str(b.birthDate, 10)
  const address   = str(b.address)
  const postalCode = str(b.postalCode, 16)
  const city      = str(b.city, 120)
  const gender    = str(b.gender, 20)

  const admin = createAdminClient()
  const { data: created, error } = await admin.from('vh_client').insert({
    first_name:  firstName,
    last_name:   lastName,
    email:       email || null,
    phone:       phone || null,
    birth_date:  birthDate || null,
    address:     address || null,
    postal_code: postalCode || null,
    city:        city || null,
    ...(gender ? { gender } : {}),
  }).select('id').single()

  if (error || !created) {
    console.error('[clients] aanmaken mislukt:', error)
    return NextResponse.json({ error: 'Cliënt aanmaken mislukt.' }, { status: 500 })
  }

  try {
    await upsertIdentity(admin, created.id as string, {
      firstName, lastName,
      email: email || null, phone: phone || null, birthDate: birthDate || null,
      address: address || null, postalCode: postalCode || null, city: city || null,
    })
  } catch (e) { console.error('[pii] kluis schrijven mislukt (client create):', e) }

  return NextResponse.json({ ok: true, id: created.id })
}
