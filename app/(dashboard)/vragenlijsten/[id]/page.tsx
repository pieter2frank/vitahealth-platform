import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, ScrollText, Users, CheckCircle2, Clock, ChevronRight, Pencil } from 'lucide-react'
import { AssignQuestionnaireForm } from './AssignQuestionnaireForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { getCurrentUser } from '@/lib/auth/guard'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'

export default async function VragenlijstDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: q } = await supabase
    .from('vh_questionnaire')
    .select('*')
    .eq('id', id)
    .single()

  if (!q) notFound()

  // Vragenlijsten bewerken is voorbehouden aan admins (zie de bewerken-pagina).
  const me = await getCurrentUser()
  const isAdmin = me?.role === 'admin'

  const [{ data: assignments }, { data: clients }] = await Promise.all([
    supabase
      .from('vh_questionnaire_assignment')
      .select('id, status, assigned_at, completed_at, vh_client(id, first_name, last_name)')
      .eq('questionnaire_id', id)
      .order('assigned_at', { ascending: false }),
    supabase
      .from('vh_client')
      .select('id, first_name, last_name')
      .order('last_name'),
  ])

  const def = q.json_content as QuestionnaireDefinition
  const questions = def.questions ?? []

  // Groepeer vragen op categorie
  const categories: string[] = []
  const byCategory: Record<string, QuestionnaireQuestion[]> = {}
  for (const question of questions) {
    const cat = question.category ?? '__geen__'
    if (!byCategory[cat]) { byCategory[cat] = []; if (cat !== '__geen__') categories.push(cat) }
    byCategory[cat].push(question)
  }
  const hasCategories = categories.length > 0
  const groupKeys = hasCategories ? categories : ['__geen__']

  const clientList = (clients ?? []).map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/vragenlijsten" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar vragenlijsten
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
              <ScrollText size={20} className="text-[#1f1683]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1e293b]">{q.title}</h1>
              <p className="text-sm text-[#64748b] mt-0.5 font-mono">{q.slug} · {questions.length} vragen · v{q.version ?? 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${
              q.status === 'active'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>
              {q.status === 'active' ? 'Actief' : 'Concept'}
            </span>
            {isAdmin && (
              <Link
                href={`/vragenlijsten/${q.id}/bewerken`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f1683] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
              >
                <Pencil size={14} />
                Bewerken
              </Link>
            )}
            <DeleteButton
              table="vh_questionnaire"
              id={q.id}
              redirectTo="/vragenlijsten"
              entityLabel={q.title}
              blockedMessage={
                assignments && assignments.length > 0
                  ? `Er zijn ${assignments.length} toewijzing(en) voor deze vragenlijst. Verwijder de toewijzingen eerst.`
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Vragen overzicht */}
        <div className="lg:col-span-3 space-y-4">
          {groupKeys.map((key) => (
            <div key={key} className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
              {hasCategories && (
                <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#1e293b]">{key}</h2>
                  <p className="text-xs text-[#94a3b8]">{byCategory[key].length} vragen</p>
                </div>
              )}
              {!hasCategories && (
                <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-3">
                  <h2 className="text-sm font-semibold text-[#1e293b]">Vragen</h2>
                </div>
              )}
              <ol className="divide-y divide-[#f1f5f9]">
                {byCategory[key].map((question, i) => (
                  <li key={question.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-xs font-mono text-[#94a3b8] mt-0.5 shrink-0 w-6 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#1e293b]">{question.label}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-mono text-[#94a3b8] bg-[#f8fafc] rounded px-1.5 py-0.5 border border-[#e2e8f0]">
                          {question.type}
                        </span>
                        {question.required && (
                          <span className="text-xs text-[#94a3b8]">verplicht</span>
                        )}
                        {question.type === 'radio' && question.options && (
                          <span className="text-xs text-[#64748b]">
                            {question.options.map(o => o.label).join(' · ')}
                          </span>
                        )}
                        {question.type === 'rating_10' && question.leftLabel && (
                          <span className="text-xs text-[#64748b]">
                            {question.leftLabel} → {question.rightLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        {/* Rechterkolom: toewijzen + toewijzingen */}
        <div className="lg:col-span-2 space-y-4">
          {/* Toewijzen */}
          <AssignQuestionnaireForm
            questionnaireId={q.id}
            clients={clientList}
          />

          {/* Toewijzingen overzicht */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#e2e8f0] px-4 py-3 bg-[#f8fafc]">
              <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
                <Users size={14} className="text-[#94a3b8]" />
                Toewijzingen ({assignments?.length ?? 0})
              </h2>
            </div>
            {!assignments || assignments.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#94a3b8] text-center">
                Nog niet toegewezen aan cliënten.
              </p>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {assignments.map((a) => {
                  const client = a.vh_client as unknown as { id: string; first_name: string; last_name: string } | null
                  const isDone = a.status === 'completed'
                  return (
                    <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1e293b] truncate">
                          {client ? `${client.first_name} ${client.last_name}` : '—'}
                        </p>
                        <p className="text-xs text-[#94a3b8]">{formatDate(a.assigned_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isDone ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600">
                            <CheckCircle2 size={12} /> Ingevuld
                          </span>
                        ) : (
                          <Link
                            href={`/vragenlijsten/${q.id}/invullen/${a.id}`}
                            className="inline-flex items-center gap-1 text-xs text-[#1f1683] hover:underline"
                          >
                            <Clock size={12} /> Invullen
                            <ChevronRight size={11} />
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
