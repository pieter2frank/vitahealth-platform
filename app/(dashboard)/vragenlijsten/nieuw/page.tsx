import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRolePage } from '@/lib/auth/guard'
import { QuestionnaireBuilder } from '../QuestionnaireBuilder'
import type { QuestionnaireDefinition } from '@/types'

export const metadata = { title: 'Nieuwe vragenlijst — Vita Health' }

export default async function NieuweVragenlijstPage() {
  await requireRolePage(['admin'], '/vragenlijsten')

  const initial: QuestionnaireDefinition = { id: '', title: '', status: 'draft', version: 1, questions: [] }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/vragenlijsten" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar vragenlijsten
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Nieuwe vragenlijst</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Bouw de vragenlijst op met vragen en antwoordopties.</p>
      </div>
      <QuestionnaireBuilder mode="create" initial={initial} />
    </div>
  )
}
