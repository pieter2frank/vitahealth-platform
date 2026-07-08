/**
 * POST /api/admin/medewerkers/[id]/ban   { hold: boolean }
 *
 * Zet een medewerker on hold (blokkeert inloggen) of heft dat op. Alleen admin.
 * Je kunt jezelf niet on hold zetten.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { z } from 'zod'

const schema = z.object({ hold: z.boolean() })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('vh_medewerker').select('user_id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })

  if (target.user_id === auth.userId) {
    return NextResponse.json({ error: 'Je kunt jezelf niet on hold zetten.' }, { status: 400 })
  }

  // ban_duration: lange duur = on hold; 'none' = weer actief
  const { error } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: parsed.data.hold ? '876000h' : 'none',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, hold: parsed.data.hold })
}
