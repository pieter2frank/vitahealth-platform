/**
 * POST /api/admin/medewerkers/[id]/ban   { hold: boolean }
 *
 * Zet een medewerker on hold (blokkeert inloggen) of heft dat op. Alleen admin.
 * Je kunt jezelf niet on hold zetten.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { z } from 'zod'

const schema = z.object({ hold: z.boolean() })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: target } = await admin
    .from('vh_medewerker').select('user_id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })

  if (target.user_id === user.id) {
    return NextResponse.json({ error: 'Je kunt jezelf niet on hold zetten.' }, { status: 400 })
  }

  // ban_duration: lange duur = on hold; 'none' = weer actief
  const { error } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: parsed.data.hold ? '876000h' : 'none',
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, hold: parsed.data.hold })
}
