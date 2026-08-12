import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// PATCH  /api/resellers/[id]  — gegevens bijwerken of activeren/deactiveren
// DELETE /api/resellers/[id]  — verwijderen (alleen als er geen bestellingen zijn)
// Alleen admin.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige reseller.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

  const patch: Record<string, unknown> = {}
  if (typeof b.active === 'boolean') patch.active = b.active
  if (b.name !== undefined) {
    const name = str(b.name, 160)
    if (!name) return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 })
    patch.name = name
  }
  if (b.email !== undefined) {
    const email = str(b.email, 160)
    if (email && !email.includes('@')) return NextResponse.json({ error: 'Ongeldig e-mailadres.' }, { status: 400 })
    patch.email = email || null
  }
  if (b.contactPerson !== undefined) patch.contact_person = str(b.contactPerson, 160) || null
  if (b.phone !== undefined)         patch.phone = str(b.phone, 40) || null
  if (b.address !== undefined)       patch.address = str(b.address) || null
  if (b.postalCode !== undefined)    patch.postal_code = str(b.postalCode, 16) || null
  if (b.city !== undefined)          patch.city = str(b.city, 120) || null
  if (b.kvk !== undefined)           patch.kvk = str(b.kvk, 40) || null
  if (b.note !== undefined)          patch.note = str(b.note, 500) || null

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Niets te wijzigen.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_reseller').update(patch).eq('id', id)
  if (error) { console.error('[reseller] wijzigen mislukt:', error); return NextResponse.json({ error: 'Wijzigen mislukt.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige reseller.' }, { status: 400 })

  const admin = createAdminClient()

  // Attributie beschermen: niet verwijderen als er al bestellingen aan hangen.
  const { count } = await admin
    .from('vh_order').select('id', { count: 'exact', head: true }).eq('reseller_id', id)
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Deze reseller heeft bestellingen; deactiveer hem in plaats van verwijderen.' }, { status: 409 })
  }

  // Gekoppelde codes worden ontkoppeld (on delete set null); daarna de reseller weg.
  const { error } = await admin.from('vh_reseller').delete().eq('id', id)
  if (error) { console.error('[reseller] verwijderen mislukt:', error); return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
