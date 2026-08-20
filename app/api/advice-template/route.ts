import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { TEMPLATE_SETTING_KEY } from '@/lib/ai/advice'

// POST   /api/advice-template  { template }  — sjabloon opslaan (vh_ai_setting)
// DELETE /api/advice-template               — terug naar de standaard uit de code

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const template = typeof b.template === 'string' ? b.template.trim() : ''
  if (!template) return NextResponse.json({ error: 'Sjabloon mag niet leeg zijn.' }, { status: 400 })
  if (template.length > 6000) return NextResponse.json({ error: 'Sjabloon is te lang (max 6000 tekens).' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('vh_ai_setting')
    .upsert({ key: TEMPLATE_SETTING_KEY, value: template, updated_at: new Date().toISOString(), updated_by: auth.role })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_ai_setting').delete().eq('key', TEMPLATE_SETTING_KEY)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
