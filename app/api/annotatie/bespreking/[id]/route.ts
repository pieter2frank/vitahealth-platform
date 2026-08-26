import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// PATCH  /api/annotatie/bespreking/[id]  { status: 'open' | 'afgerond' }
// DELETE /api/annotatie/bespreking/[id]  — alleen admin

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts', 'admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  if (b.status !== 'open' && b.status !== 'afgerond') {
    return NextResponse.json({ error: 'Ongeldige status.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('vh_team_meeting').update({ status: b.status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_team_meeting').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
