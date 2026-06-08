/**
 * POST /api/admin/consents
 *
 * Publiceert een nieuwe versie van de toestemmingsteksten. Alleen admin.
 * De vorige versies blijven bewaard; de nieuwe versie wordt actief.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const schema = z.object({
  required: z.array(z.string().trim().min(1)).min(1, 'Minimaal één verplichte toestemming.'),
  optional: z.array(z.string().trim().min(1)),
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const { data: me } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Ongeldige invoer.' }, { status: 400 })
  }
  const { required, optional } = parsed.data

  const admin = createAdminClient()

  // Hoogste bestaande versienummer ophalen
  const { data: latest } = await admin
    .from('vh_consent_version')
    .select('version')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const newVersion = (latest?.version ?? 0) + 1

  // Alle versies deactiveren (partial unique index staat één actieve toe)
  const { error: deactErr } = await admin
    .from('vh_consent_version')
    .update({ is_active: false })
    .eq('is_active', true)
  if (deactErr) return NextResponse.json({ error: deactErr.message }, { status: 500 })

  // Nieuwe actieve versie invoegen
  const { error: insErr } = await admin
    .from('vh_consent_version')
    .insert({
      version:        newVersion,
      required_texts: required,
      optional_texts: optional,
      is_active:      true,
      created_by:     user.id,
    })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, version: newVersion })
}
