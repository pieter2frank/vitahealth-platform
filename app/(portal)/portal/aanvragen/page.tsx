import { createClient } from '@/lib/supabase/server'
import { EnrollmentForm } from '../aanmelden/EnrollmentForm'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'
import { REQUIRED_CONSENTS, OPTIONAL_CONSENTS } from '@/lib/consents'

export const metadata = { title: 'Aanmelden — Vita Health' }

export default async function AanvragenPage() {
  const supabase = await createClient()

  // Actieve toestemmingsteksten ophalen (DB-versie). Vangnet: als de database
  // (nog) geen versie heeft, val terug op de teksten in de code (versie 2).
  const { data: consentData } = await supabase.rpc('get_active_consents')
  const dbRequired = (consentData?.required as string[] | undefined) ?? []
  const dbOptional = (consentData?.optional as string[] | undefined) ?? []
  const requiredConsents = dbRequired.length > 0 ? dbRequired : [...REQUIRED_CONSENTS]
  const optionalConsents = dbRequired.length > 0 ? dbOptional : [...OPTIONAL_CONSENTS]
  const consentVersion   = (consentData?.version as number | undefined) ?? 2

  // Intake vragenlijst ophalen uit instellingen
  const { data: setting } = await supabase
    .from('vh_setting')
    .select('value')
    .eq('key', 'intake_questionnaire_id')
    .maybeSingle()

  let intakeQuestionnaire: { id: string; title: string; questions: QuestionnaireQuestion[] } | null = null

  if (setting?.value) {
    const { data: q } = await supabase
      .from('vh_questionnaire')
      .select('id, title, json_content')
      .eq('id', setting.value)
      .single()

    if (q) {
      const def = q.json_content as QuestionnaireDefinition
      intakeQuestionnaire = {
        id: q.id,
        title: q.title,
        questions: def.questions ?? [],
      }
    }
  }

  return (
    <main className="py-10 px-6">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#1e293b]">Aanmelden voor de Vita Health Check</h1>
          <p className="text-sm text-[#64748b] mt-1.5 leading-relaxed">
            Vul onderstaand formulier in om je aan te melden voor de Vita Health dry-run.
          </p>
        </div>

        <EnrollmentForm
          intakeQuestionnaire={intakeQuestionnaire}
          requiredConsents={requiredConsents}
          optionalConsents={optionalConsents}
          consentVersion={consentVersion}
        />
      </div>
    </main>
  )
}
