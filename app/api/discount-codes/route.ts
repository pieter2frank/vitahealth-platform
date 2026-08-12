import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// POST /api/discount-codes  — nieuwe kortingscode aanmaken. Alleen admin.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CODE_RE = /^[A-Z0-9_-]{2,32}$/

export async function POST(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const code = typeof b.code === 'string' ? b.code.trim().toUpperCase() : ''
  const type = b.type === 'fixed' ? 'fixed' : b.type === 'percent' ? 'percent' : ''
  const value = Number(b.value)
  const packageId = typeof b.packageId === 'string' && b.packageId ? b.packageId : null
  const resellerId = typeof b.resellerId === 'string' && b.resellerId ? b.resellerId : null
  const maxUses = b.maxUses === null || b.maxUses === undefined || b.maxUses === '' ? null : Number(b.maxUses)
  const validUntil = typeof b.validUntil === 'string' && b.validUntil ? b.validUntil : null
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : ''

  if (!CODE_RE.test(code)) return NextResponse.json({ error: 'Code mag alleen letters, cijfers, - en _ bevatten (2–32 tekens).' }, { status: 400 })
  if (!type) return NextResponse.json({ error: 'Kies een kortingstype.' }, { status: 400 })
  if (!Number.isFinite(value) || value <= 0) return NextResponse.json({ error: 'Vul een geldige waarde in.' }, { status: 400 })
  if (type === 'percent' && value > 100) return NextResponse.json({ error: 'Een percentage kan niet hoger zijn dan 100.' }, { status: 400 })
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) return NextResponse.json({ error: 'Max. gebruik moet een positief getal zijn.' }, { status: 400 })
  if (packageId && !isUuid(packageId)) return NextResponse.json({ error: 'Ongeldig pakket.' }, { status: 400 })
  if (resellerId && !isUuid(resellerId)) return NextResponse.json({ error: 'Ongeldige reseller.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('vh_discount_code').insert({
    code, type, value: Math.round(value),
    package_id: packageId,
    reseller_id: resellerId,
    max_uses: maxUses,
    valid_until: validUntil,
    note: note || null,
    created_by: auth.name,
    active: true,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Deze code bestaat al.' }, { status: 409 })
    console.error('[discount] aanmaken mislukt:', error)
    return NextResponse.json({ error: 'Aanmaken mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: data.id })
}
