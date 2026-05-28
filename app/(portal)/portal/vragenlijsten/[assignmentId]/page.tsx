import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ScrollText, User } from 'lucide-react'
import { PublicQuestionnairePlayer } from './PublicQuestionnairePlayer'
import type { QuestionnaireDefinition } from '@/types'

export default async function PubliekeVragenlijstPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>
}) {
  const { assignmentId } = await params
  const supabase = await createClient()

  const { data: assignment } = await supabase
    .from('vh_questionnaire_assignment')
    .select('id, status, client_id, questionnaire_id, vh_client(first_name, last_name), vh_questionnaire(title, json_content)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) notFound()

  const client = assignment.vh_client as { first_name: string; last_name: string } | null
  const q = assignment.vh_questionnaire as { title: string; json_content: QuestionnaireDefinition } | null

  if (!q) notFound()

  const def = q.json_content

  return (
    <main className="py-10 px-6">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef4ff] mb-4">
            <ScrollText size={22} className="text-[#1f1683]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1e293b]">{q.title}</h1>
          {client && (
            <p className="text-sm text-[#64748b] mt-1 flex items-center justify-center gap-1.5">
              <User size={13} />
              {client.first_name} {client.last_name}
            </p>
          )}
        </div>

        {/* Al ingevuld */}
        {assignment.status === 'completed' ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
              <ScrollText size={22} className="text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-green-800 mb-1">Al ingevuld</h2>
            <p className="text-sm text-green-700">
              Je hebt deze vragenlijst al ingevuld. Bedankt!
            </p>
          </div>
        ) : (
          <PublicQuestionnairePlayer
            questions={def.questions ?? []}
            assignmentId={assignmentId}
            questionnaireId={assignment.questionnaire_id}
            clientId={assignment.client_id}
          />
        )}
      </div>
    </main>
  )
}
