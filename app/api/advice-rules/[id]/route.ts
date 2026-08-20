import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeString } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { isKnowledgeDomain } from '@/lib/knowledge-domains'
import { sanitizeConditions } from '@/lib/ai/rules'
import { isUuid } from '@/lib/validation'

// PATCH  /api/advice-rules/[id]  { active? | name? instruction? domain? conditions? }
// DELETE /api/advice-rules/[id]

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (typeof b.active === 'boolean') patch.active = b.active
  if (b.name !== undefined) {
    const name = sanitizeString(b.name, 120)
    if (!name) return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 })
    patch.name = name
  }
  if (b.instruction !== undefined) {
    const instruction = typeof b.instruction === 'string' ? b.instruction.trim().slice(0, 2000) : ''
    if (!instruction) return NextResponse.json({ error: 'Instructie is verplicht.' }, { status: 400 })
    patch.instruction = instruction
  }
  if (b.domain !== undefined) {
    const domain = sanitizeString(b.domain, 40) || null
    if (domain !== null && !isKnowledgeDomain(domain)) return NextResponse.json({ error: 'Ongeldig domein.' }, { status: 400 })
    patch.domain = domain
  }
  if (b.conditions !== undefined) {
    const conditions = sanitizeConditions(b.conditions)
    if (!conditions) return NextResponse.json({ error: 'Ongeldige condities.' }, { status: 400 })
    patch.conditions = conditions
  }

  const admin = createAdminClient()
  const { error } = await admin.from('vh_advice_rule').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_advice_rule').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
