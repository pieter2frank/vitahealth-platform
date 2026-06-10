/**
 * PUT /api/admin/vragenlijsten/[id]  — publiceer wijzigingen aan een vragenlijst.
 *
 * Versielogica:
 *  - Heeft de HUIDIGE versie al antwoorden? → nieuwe versie (version + 1) +
 *    nieuwe snapshot. Oude antwoorden blijven gekoppeld aan hun eigen versie.
 *  - Nog geen antwoorden op de huidige versie? → in-place bijwerken (zelfde
 *    versienummer, snapshot overschreven). Voorkomt versie-inflatie bij concepten.
 *
 * Alleen admin.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateDefinition } from '@/lib/questionnaire'
import { isUuid } from '@/lib/validation'
import type { QuestionnaireDefinition } from '@/types'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') return NextResponse.json({ error: 'Geen toegang.' }, { status: 403 })

  let body: Partial<QuestionnaireDefinition>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Ongeldige aanvraag.' }, { status: 400 }) }

  const { ok, errors } = validateDefinition(body)
  if (!ok) return NextResponse.json({ error: errors.join(' ') }, { status: 422 })

  const admin = createAdminClient()
  const { data: current } = await admin
    .from('vh_questionnaire').select('id, slug, version').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Vragenlijst niet gevonden.' }, { status: 404 })

  // Hoeveel antwoorden zijn er tegen de huidige versie ingevuld?
  const { count: responsesOnCurrent } = await admin
    .from('vh_questionnaire_response')
    .select('*', { count: 'exact', head: true })
    .eq('questionnaire_id', id)
    .eq('questionnaire_version', current.version)

  const title = body.title!.trim()
  const status = body.status === 'active' ? 'active' : 'draft'
  const bumpVersion = (responsesOnCurrent ?? 0) > 0
  const newVersion = bumpVersion ? current.version + 1 : current.version

  const definition: QuestionnaireDefinition = {
    id: current.slug,
    title,
    status,
    version: newVersion,
    description: body.description?.trim() || undefined,
    questions: body.questions!,
  }

  const { error: updErr } = await admin
    .from('vh_questionnaire')
    .update({ title, status, version: newVersion, json_content: definition })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  if (bumpVersion) {
    await admin.from('vh_questionnaire_version').insert({
      questionnaire_id: id, version: newVersion, json_content: definition, created_by: user.id,
    })
  } else {
    // Bestaande snapshot overschrijven (of aanmaken als die ontbreekt)
    const { data: existingSnap } = await admin
      .from('vh_questionnaire_version')
      .select('id').eq('questionnaire_id', id).eq('version', newVersion).maybeSingle()
    if (existingSnap) {
      await admin.from('vh_questionnaire_version')
        .update({ json_content: definition, created_by: user.id, created_at: new Date().toISOString() })
        .eq('id', existingSnap.id)
    } else {
      await admin.from('vh_questionnaire_version').insert({
        questionnaire_id: id, version: newVersion, json_content: definition, created_by: user.id,
      })
    }
  }

  return NextResponse.json({ ok: true, version: newVersion, newVersionCreated: bumpVersion })
}
