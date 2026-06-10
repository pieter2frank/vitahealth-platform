/**
 * POST /api/admin/vragenlijsten
 *
 * Maakt een nieuwe vragenlijst aan (versie 1). Alleen admin.
 * Slaat zowel de actieve definitie (vh_questionnaire) als de versie-snapshot
 * (vh_questionnaire_version) op.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateDefinition, slugify } from '@/lib/questionnaire'
import type { QuestionnaireDefinition } from '@/types'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  let body: Partial<QuestionnaireDefinition> & { slug?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 }) }

  const { ok, errors } = validateDefinition(body)
  if (!ok) return NextResponse.json({ error: errors.join(' ') }, { status: 422 })

  const slug = slugify(body.slug || body.title || '') || `vragenlijst_${Date.now()}`
  const title = body.title!.trim()
  const status = body.status === 'active' ? 'active' : 'draft'

  const definition: QuestionnaireDefinition = {
    id: slug,
    title,
    status,
    version: 1,
    description: body.description?.trim() || undefined,
    questions: body.questions!,
  }

  const admin = createAdminClient()
  const { data: inserted, error: insErr } = await admin
    .from('vh_questionnaire')
    .insert({ slug, title, status, version: 1, json_content: definition })
    .select('id')
    .single()

  if (insErr) {
    return NextResponse.json({
      error: insErr.code === '23505' ? `Er bestaat al een vragenlijst met id "${slug}".` : insErr.message,
    }, { status: 400 })
  }

  await admin.from('vh_questionnaire_version').insert({
    questionnaire_id: inserted.id,
    version: 1,
    json_content: definition,
    created_by: user.id,
  })

  return NextResponse.json({ ok: true, id: inserted.id })
}
