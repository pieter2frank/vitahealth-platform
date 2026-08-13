import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { upsertIdentity } from '@/lib/pii/identity'

// POST /api/portal/personalia
// Portal-personalia (intake stap 1-2) lopen vanaf fase 1 van de PII-kluis via de
// server: de browser kan niet versleutelen. Dubbelschrijft naar de oude kolommen
// (nog leidend) én de kluis. Vervangt de directe browser-writes + de
// portal_register_client-aanroep vanuit de browser.
//
// Twee vormen:
//  { create: true, firstName, lastName, email, phone?, birthDate?, address, postalCode, city }
//    → nieuwe cliënt (via de bestaande SECURITY DEFINER-RPC), geeft { id } terug.
//  { clientId, phone?, birthDate?, address?, postalCode?, city? }
//    → bestaande (uitgenodigde) cliënt bijwerken; alleen toegestaan zolang het
//      traject in de vroege intake-fase zit (zelfde grens als de oude RLS-policy).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EARLY_STATUSES = ['aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld']

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const admin = createAdminClient()

  // ── Nieuwe cliënt (intake stap 2, niet-uitgenodigd) ─────────────────────────
  if (b.create === true) {
    const firstName = str(b.firstName, 120)
    const lastName  = str(b.lastName, 120)
    const email     = str(b.email, 160)
    const phone     = str(b.phone, 40)
    const birthDate = str(b.birthDate, 10)
    const address   = str(b.address)
    const postalCode = str(b.postalCode, 16)
    const city      = str(b.city, 120)
    if (!firstName || !lastName || !email.includes('@') || !address || !postalCode || !city) {
      return NextResponse.json({ error: 'Vul alle verplichte velden in.' }, { status: 400 })
    }

    const { data: newId, error } = await admin.rpc('portal_register_client', {
      p_first_name: firstName, p_last_name: lastName, p_email: email,
      p_phone: phone || null, p_birth_date: birthDate || null,
      p_address: address, p_postal_code: postalCode, p_city: city,
    })
    if (error || !newId) {
      console.error('[portal] registratie mislukt:', error)
      return NextResponse.json({ error: 'Registratie mislukt.' }, { status: 500 })
    }

    // Kluis (best-effort is hier NIET goed genoeg: dubbelschrijven moet kloppen —
    // bij een fout melden we dat, de oude kolommen zijn dan al gevuld en de
    // backfill herstelt de kluis alsnog).
    try {
      await upsertIdentity(admin, newId as string, {
        firstName, lastName, email,
        phone: phone || null, birthDate: birthDate || null,
        address, postalCode, city,
      })
    } catch (e) { console.error('[pii] kluis schrijven mislukt (create):', e) }

    return NextResponse.json({ ok: true, id: newId })
  }

  // ── Bestaande (uitgenodigde) cliënt bijwerken ───────────────────────────────
  const clientId = typeof b.clientId === 'string' ? b.clientId : ''
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 })

  const { data: client } = await admin
    .from('vh_client').select('id, enrollment_status').eq('id', clientId).maybeSingle()
  if (!client || !EARLY_STATUSES.includes((client.enrollment_status as string) ?? '')) {
    return NextResponse.json({ error: 'Deze aanmelding kan niet meer worden gewijzigd.' }, { status: 403 })
  }

  // Alleen de velden die de portal echt bewerkt (naam/e-mail blijven van de uitnodiging).
  const patch: Record<string, string | null> = {}
  const vault: Parameters<typeof upsertIdentity>[2] = {}
  if ('phone' in b)      { patch.phone       = str(b.phone, 40) || null;  vault.phone      = patch.phone }
  if ('birthDate' in b)  { patch.birth_date  = str(b.birthDate, 10) || null; vault.birthDate = patch.birth_date }
  if ('address' in b)    { patch.address     = str(b.address) || null;    vault.address    = patch.address }
  if ('postalCode' in b) { patch.postal_code = str(b.postalCode, 16) || null; vault.postalCode = patch.postal_code }
  if ('city' in b)       { patch.city        = str(b.city, 120) || null;  vault.city       = patch.city }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Niets te wijzigen.' }, { status: 400 })

  const { error: updErr } = await admin.from('vh_client').update(patch).eq('id', clientId)
  if (updErr) {
    console.error('[portal] personalia bijwerken mislukt:', updErr)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }
  try { await upsertIdentity(admin, clientId, vault) }
  catch (e) { console.error('[pii] kluis schrijven mislukt (update):', e) }

  return NextResponse.json({ ok: true })
}
