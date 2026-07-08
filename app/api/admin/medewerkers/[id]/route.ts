/**
 * PATCH  /api/admin/medewerkers/[id]   { name?, role? }   — gegevens/rol aanpassen
 * DELETE /api/admin/medewerkers/[id]                       — medewerker verwijderen
 *
 * Alleen admin. De admin-rol kan uitsluitend door een admin worden toegekend.
 * Je kunt jezelf niet verwijderen of je eigen rol verlagen (voorkomt lockout).
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  role: z.enum(['admin', 'arts', 'leefstijlarts', 'medewerker']).optional(),
})

async function requireAdmin() {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return { error: auth.error, status: auth.status }
  return { userId: auth.userId }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('vh_medewerker').select('id, user_id, role').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })

  // Voorkom dat je je eigen admin-rol verlaagt (lockout-bescherming)
  if (target.user_id === auth.userId && parsed.data.role && parsed.data.role !== 'admin') {
    return NextResponse.json({ error: 'Je kunt je eigen beheerdersrol niet verlagen.' }, { status: 400 })
  }

  const update: Record<string, string> = {}
  if (parsed.data.name) update.name = parsed.data.name
  if (parsed.data.role) update.role = parsed.data.role
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })

  const { error } = await admin.from('vh_medewerker').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('vh_medewerker').select('id, user_id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })

  if (target.user_id === auth.userId) {
    return NextResponse.json({ error: 'Je kunt jezelf niet verwijderen.' }, { status: 400 })
  }

  // Auth-gebruiker verwijderen — vh_medewerker cascadeert (FK on delete cascade)
  const { error } = await admin.auth.admin.deleteUser(target.user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
