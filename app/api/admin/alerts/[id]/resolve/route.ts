import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  // Controleer admin-rol
  const { data: medewerker } = await supabase.from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (medewerker?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('vh_alert')
    .update({ resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq('id', id)
    .is('resolved_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
