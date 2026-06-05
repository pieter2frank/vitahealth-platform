import { createClient } from '@/lib/supabase/server'
import { EnrollmentForm } from './EnrollmentForm'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'

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
      initialResumeInfo = {
        clientId:     data.client_id,
        status:       data.status,
        firstName:    data.first_name    ?? '',
        lastName:     data.last_name     ?? '',
        email:        data.email         ?? '',
        phone:        data.phone         ?? '',
        birthDate:    data.birth_date    ?? '',
        address:      data.address       ?? '',
        postalCode:   data.postal_code   ?? '',
        city:         data.city          ?? '',
        hasAddress:   data.has_address   ?? false,
        assignmentId: data.assignment_id ?? null,
        token:        data.token         ?? token ?? null,
      }
    }
  }

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
          <h1 className="text-2xl font-bold text-[#1e293b]">Aanmelden voor de biomarkertest</h1>
          <p className="text-sm text-[#64748b] mt-1.5 leading-relaxed">
            Vul onderstaand formulier in om je aan te melden voor de Vita Health dry-run.
          </p>
        </div>

        <EnrollmentForm
          intakeQuestionnaire={intakeQuestionnaire}
          initialEmail={initialEmail}
          initialResumeInfo={initialResumeInfo}
        />
      </div>
    </main>
  )
}
