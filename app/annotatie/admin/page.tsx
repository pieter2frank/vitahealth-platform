import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { caseLabel } from '@/lib/annotation'
import { RondeForm } from './RondeForm'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function AdminRondesPage() {
  await requireAnnotationAccess(['admin'])
  const admin = createAdminClient()

  // Geschikt = dossier met zowel een ingevulde vragenlijst als een biomarkeruitslag.
  const [{ data: reps }, { data: qrs }] = await Promise.all([
    admin.from('vh_report').select('client_id'),
    admin.from('vh_questionnaire_response').select('client_id'),
  ])
  const withQ = new Set((qrs ?? []).map(q => q.client_id))
  const eligibleIds = [...new Set((reps ?? []).map(r => r.client_id))].filter(id => withQ.has(id))

  const { data: clients } = eligibleIds.length
    ? await admin.from('vh_client').select('id, gender, birth_date').in('id', eligibleIds)
    : { data: [] as { id: string; gender: string | null; birth_date: string | null }[] }

  const options = (clients ?? [])
    .map(c => ({ id: c.id, label: caseLabel(c.birth_date, c.gender) }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const { data: rounds } = await admin
    .from('vh_annotation_round')
    .select('id, title, status, created_at, vh_annotation_case ( id )')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1e293b]">Annotatieronde samenstellen</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          Kies de dossiers waarvan zowel de vragenlijst als de biomarkeruitslag beschikbaar is.
          Alle artsen krijgen bericht dat er casussen klaarstaan.
        </p>
      </div>

      <RondeForm options={options} />

      {(rounds ?? []).length > 0 && (
        <section className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[#1e293b]">Recente rondes</h2>
          </div>
          <ul className="divide-y divide-[#f1f5f9]">
            {(rounds ?? []).map(r => {
              const count = Array.isArray(r.vh_annotation_case) ? r.vh_annotation_case.length : 0
              return (
                <li key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="font-medium text-[#1e293b]">{r.title}</span>
                  <span className="flex items-center gap-3 text-xs text-[#94a3b8]">
                    <span>{count} casus{count === 1 ? '' : 'sen'}</span>
                    <span>{formatDate(r.created_at)}</span>
                    <span className={`rounded-full border px-2 py-0.5 font-medium ${r.status === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                      {r.status === 'open' ? 'Open' : 'Gesloten'}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
