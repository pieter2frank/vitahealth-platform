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

  // Token-gescopet ophalen via SECURITY DEFINER-RPC (geen directe leestoegang
  // op vh_client/vh_intake_token met de anon-key — zie migratie 059/060).
  const { data: a } = await supabase.rpc('portal_get_assignment', { p_assignment_id: assignmentId })
  const assignment = a as {
    status: string; client_id: string; questionnaire_id: string
    title: string; json_content: QuestionnaireDefinition
    first_name: string | null; last_name: string | null; token: string | null
  } | null

  if (!assignment?.json_content) notFound()

  const client = assignment.first_name
    ? { first_name: assignment.first_name, last_name: assignment.last_name ?? '' }
    : null
  const q = { title: assignment.title }
  const def = assignment.json_content

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  const statusUrl = assignment.token
    ? `${portalUrl}/portal/status/${assignment.token}`
    : null

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
            statusUrl={statusUrl}
          />
        )}
      </div>
    </main>
  )
}
