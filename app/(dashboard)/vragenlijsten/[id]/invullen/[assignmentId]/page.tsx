import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User } from 'lucide-react'
import { QuestionnairePlayer } from './QuestionnairePlayer'
import type { QuestionnaireDefinition } from '@/types'

export default async function InvullenPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>
}) {
  const { id, assignmentId } = await params
  const supabase = await createClient()

  const { data: assignment } = await supabase
    .from('vh_questionnaire_assignment')
    .select('id, status, questionnaire_id, client_id, vh_client(first_name, last_name), vh_questionnaire(title, json_content)')
    .eq('id', assignmentId)
    .single()

  if (!assignment) notFound()
  if (assignment.questionnaire_id !== id) notFound()

  const client = assignment.vh_client as unknown as { first_name: string; last_name: string } | null
  const q = assignment.vh_questionnaire as unknown as { title: string; json_content: QuestionnaireDefinition } | null

  if (!q) notFound()

  const def = q.json_content

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href={`/vragenlijsten/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar vragenlijst
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">{q.title}</h1>
        {client && (
          <p className="text-sm text-[#64748b] mt-1 flex items-center gap-1.5">
            <User size={13} />
            Cliënt: <span className="font-medium">{client.first_name} {client.last_name}</span>
          </p>
        )}
      </div>

      {assignment.status === 'completed' ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-700">
          Deze vragenlijst is al ingevuld voor deze cliënt.
        </div>
      ) : (
        <QuestionnairePlayer
          questions={def.questions ?? []}
          assignmentId={assignmentId}
          questionnaireId={id}
          clientId={assignment.client_id}
          redirectTo={`/vragenlijsten/${id}`}
        />
      )}
    </div>
  )
}
