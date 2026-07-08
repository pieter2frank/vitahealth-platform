import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRolePage } from '@/lib/auth/guard'
import { QuestionnaireBuilder } from '../../QuestionnaireBuilder'
import type { QuestionnaireDefinition } from '@/types'

export const metadata = { title: 'Vragenlijst bewerken — Vita Health' }

export default async function BewerkVragenlijstPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireRolePage(['admin'], '/vragenlijsten')
  const supabase = await createClient()

  const { data: q } = await supabase
    .from('vh_questionnaire').select('id, json_content, version').eq('id', id).single()
  if (!q) notFound()

  // Hoeveel antwoorden tegen de huidige versie? → bepaalt de versie-waarschuwing
  const { count: responseCount } = await supabase
    .from('vh_questionnaire_response')
    .select('*', { count: 'exact', head: true })
    .eq('questionnaire_id', id)
    .eq('questionnaire_version', q.version ?? 1)

  const initial = q.json_content as QuestionnaireDefinition

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href={`/vragenlijsten/${id}`} className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar vragenlijst
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-[#1e293b]">{initial.title || 'Vragenlijst'} bewerken</h1>
          <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-xs font-medium text-[#1f1683]">v{q.version ?? 1}</span>
        </div>
        <p className="text-sm text-[#64748b] mt-0.5">Pas vragen en opties aan en publiceer de wijzigingen.</p>
      </div>
      <QuestionnaireBuilder mode="edit" questionnaireId={id} initial={initial} responseCount={responseCount ?? 0} />
    </div>
  )
}
