import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeString } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { isKnowledgeDomain } from '@/lib/knowledge-domains'
import { sanitizeConditions } from '@/lib/ai/rules'

// POST /api/advice-rules  { name, instruction, domain?, conditions }
// Maakt een als-dan richtlijn aan (RLS blokkeert schrijven → via service_role).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const name        = sanitizeString(b.name, 120)
  const instruction = typeof b.instruction === 'string' ? b.instruction.trim().slice(0, 2000) : ''
  const domain      = sanitizeString(b.domain, 40) || null

  if (!name) return NextResponse.json({ error: 'Naam is verplicht.' }, { status: 400 })
  if (!instruction) return NextResponse.json({ error: 'Instructie is verplicht.' }, { status: 400 })
  if (domain !== null && !isKnowledgeDomain(domain)) return NextResponse.json({ error: 'Ongeldig domein.' }, { status: 400 })

  const conditions = sanitizeConditions(b.conditions)
  if (!conditions) return NextResponse.json({ error: 'Ongeldige of ontbrekende condities.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vh_advice_rule')
    .insert({ name, instruction, domain, conditions, created_by: auth.role })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
