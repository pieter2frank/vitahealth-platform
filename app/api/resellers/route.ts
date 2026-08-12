import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'

// POST /api/resellers  — nieuwe reseller aanmaken. Alleen admin.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const name = str(b.name, 160)
  const email = str(b.email, 160)
  if (!name) return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 })
  if (email && !email.includes('@')) return NextResponse.json({ error: 'Ongeldig e-mailadres.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('vh_reseller').insert({
    name,
    contact_person: str(b.contactPerson, 160) || null,
    email:          email || null,
    phone:          str(b.phone, 40) || null,
    address:        str(b.address) || null,
    postal_code:    str(b.postalCode, 16) || null,
    city:           str(b.city, 120) || null,
    kvk:            str(b.kvk, 40) || null,
    note:           str(b.note, 500) || null,
    created_by:     auth.name,
    active:         true,
  }).select('id').single()

  if (error) {
    console.error('[reseller] aanmaken mislukt:', error)
    return NextResponse.json({ error: 'Aanmaken mislukt.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
