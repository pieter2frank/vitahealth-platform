import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentity } from '@/lib/pii/identity'
import { EnrollmentForm } from './EnrollmentForm'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'
import { REQUIRED_CONSENTS, OPTIONAL_CONSENTS } from '@/lib/consents'

export const metadata = { title: 'Aanmelden — Vita Health' }

interface PageProps {
  searchParams: Promise<{ email?: string; token?: string }>
}

export default async function AanmeldenPage({ searchParams }: PageProps) {
  const { email: initialEmail, token } = await searchParams
  const supabase = await createClient()

  // Token → direct naar juiste stap sturen (veilig, server-side)
  let initialResumeInfo: import('./EnrollmentForm').ResumeInfo | undefined

  if (token) {
    const { data } = await supabase.rpc('resolve_intake_token', { p_token: token })
    if (data?.exists) {
      // Fase 2 PII-kluis: persoonsgegevens komen uit de kluis (server-side
      // ontsleuteld), niet meer uit de RPC-payload.
      const identity = await getIdentity(createAdminClient(), data.client_id as string)
      initialResumeInfo = {
        clientId:     data.client_id,
        status:       data.status,
        firstName:    identity?.firstName  ?? '',
        lastName:     identity?.lastName   ?? '',
        email:        identity?.email      ?? '',
        phone:        identity?.phone      ?? '',
        birthDate:    identity?.birthDate  ?? '',
        address:      identity?.address    ?? '',
        postalCode:   identity?.postalCode ?? '',
        city:         identity?.city       ?? '',
        hasAddress:   Boolean((identity?.address ?? '').trim()),
        assignmentId: data.assignment_id ?? null,
        token:        data.token         ?? token ?? null,
        screenerChoice: (data.screener_choice as 'ok' | 'hold' | null) ?? null,
      }
    }
  }

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
      <div className="mx-auto max-w-2xl">
        {/* Paginakop */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#1e293b]">Aanmelden voor de Vita Health Check</h1>
          <p className="text-sm text-[#64748b] mt-1.5 leading-relaxed">
            Vul onderstaand formulier in om je aan te melden voor de Vita Health dry-run.
          </p>
        </div>

        <EnrollmentForm
          intakeQuestionnaire={intakeQuestionnaire}
          initialEmail={initialEmail}
          initialResumeInfo={initialResumeInfo}
          requiredConsents={requiredConsents}
          optionalConsents={optionalConsents}
          consentVersion={consentVersion}
        />
      </div>
    </main>
  )
}
