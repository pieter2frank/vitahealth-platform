import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { ScrollText, Plus, Users, FileJson } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'

export default async function VragenlijstenPage() {
  const supabase = await createClient()

  const { data: questionnaires } = await supabase
    .from('vh_questionnaire')
    .select('id, slug, title, status, json_content, created_at')
    .order('created_at', { ascending: false })

  const { data: assignments } = await supabase
    .from('vh_questionnaire_assignment')
    .select('questionnaire_id, status')

  // Tel toewijzingen per vragenlijst
  const totalByQ: Record<string, number> = {}
  const pendingByQ: Record<string, number> = {}
  for (const a of assignments ?? []) {
    totalByQ[a.questionnaire_id] = (totalByQ[a.questionnaire_id] ?? 0) + 1
    if (a.status === 'pending') pendingByQ[a.questionnaire_id] = (pendingByQ[a.questionnaire_id] ?? 0) + 1
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Vragenlijsten</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Maak en beheer vragenlijsten online
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/vragenlijsten/importeer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
          >
            <FileJson size={15} />
            Importeren
          </Link>
          <Link
            href="/vragenlijsten/nieuw"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            <Plus size={15} />
            Nieuwe vragenlijst
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {!questionnaires || questionnaires.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <ScrollText size={32} className="text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#94a3b8]">Nog geen vragenlijsten</p>
            <p className="text-xs text-[#94a3b8] mt-1">Maak online je eerste vragenlijst aan.</p>
            <Link
              href="/vragenlijsten/nieuw"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors mt-4"
            >
              <Plus size={15} />
              Eerste vragenlijst maken
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Titel</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Vragen</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toewijzingen</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegevoegd</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {questionnaires.map((q) => {
                const def = q.json_content as { questions?: unknown[] }
                const questionCount = def?.questions?.length ?? 0
                const total = totalByQ[q.id] ?? 0
                const pending = pendingByQ[q.id] ?? 0
                return (
                  <ClickableRow key={q.id} href={`/vragenlijsten/${q.id}`} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1e293b]">{q.title}</p>
                      <p className="text-xs text-[#94a3b8] font-mono">{q.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{questionCount}</td>
                    <td className="px-4 py-3">
                      {total > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                          <Users size={13} />
                          {total}
                          {pending > 0 && (
                            <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border-orange-200">
                              {pending} open
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#94a3b8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                        q.status === 'active'
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}>
                        {q.status === 'active' ? 'Actief' : 'Concept'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{formatDate(q.created_at)}</td>
                    <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                  </ClickableRow>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
