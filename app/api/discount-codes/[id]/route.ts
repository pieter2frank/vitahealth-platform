import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// PATCH  /api/discount-codes/[id]  { active }  — activeren/deactiveren
// DELETE /api/discount-codes/[id]              — verwijderen
// Alleen admin.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige code.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  if (typeof b.active !== 'boolean') return NextResponse.json({ error: 'Ongeldige wijziging.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_discount_code').update({ active: b.active }).eq('id', id)
  if (error) { console.error('[discount] wijzigen mislukt:', error); return NextResponse.json({ error: 'Wijzigen mislukt.' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige code.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_discount_code').delete().eq('id', id)
  if (error) { console.error('[discount] verwijderen mislukt:', error); return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 }) }

  return NextResponse.json({ ok: true })
}
