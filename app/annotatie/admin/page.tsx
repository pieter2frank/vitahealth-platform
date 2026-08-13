import Link from 'next/link'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentities } from '@/lib/pii/identity'
import { caseLabel } from '@/lib/annotation'
import { RondeForm } from './RondeForm'
import { formatDate } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const DISEASE: Record<string, string> = {
  heart_attack: 'Hartaanval', ischemic_stroke: 'Herseninfarct', type2_diabetes: 'Diabetes type 2',
  chronic_kidney_disease: 'Chronische nierziekte', fatty_liver_disease: 'Leververvetting',
}

interface RiskRow { disease: string; result_category: string | null }
interface ReportRow {
  client_id: string; metabolic_age: number | null; resilience_score: number | null; sample_date: string | null
  vh_report_disease_risk: RiskRow[] | null
}

export default async function AdminRondesPage() {
  await requireAnnotationAccess(['admin'])
  const admin = createAdminClient()

  // Geschikt = dossier met zowel een ingevulde vragenlijst als een biomarkeruitslag.
  const [{ data: reps }, { data: qrs }] = await Promise.all([
    admin.from('vh_report')
      .select('client_id, metabolic_age, resilience_score, sample_date, vh_report_disease_risk ( disease, result_category )')
      .order('sample_date', { ascending: false }),
    admin.from('vh_questionnaire_response').select('client_id'),
  ])
  const withQ = new Set((qrs ?? []).map(q => q.client_id))

  // Meest recente rapport per cliënt (reps is aflopend op sample_date).
  const latestReport = new Map<string, ReportRow>()
  for (const r of (reps ?? []) as ReportRow[]) {
    if (!latestReport.has(r.client_id)) latestReport.set(r.client_id, r)
  }
  const eligibleIds = [...latestReport.keys()].filter(id => withQ.has(id))

  // Fase 2 PII-kluis: geboortedatum via de toegangslaag (batch).
  const { data: clients } = eligibleIds.length
    ? await admin.from('vh_client').select('id, gender').in('id', eligibleIds)
    : { data: [] as { id: string; gender: string | null }[] }
  const identities = await getIdentities(admin, eligibleIds)

  const options = (clients ?? [])
    .map(c => {
      const r = latestReport.get(c.id)
      const meta: string[] = []
      if (r?.metabolic_age != null)    meta.push(`metabole leeftijd ${r.metabolic_age}`)
      if (r?.resilience_score != null) meta.push(`resilience ${r.resilience_score}/100`)
      const risks = (r?.vh_report_disease_risk ?? [])
        .filter(x => x.result_category && x.result_category !== 'average_or_lower')
        .map(x => DISEASE[x.disease] ?? x.disease)
      if (risks.length) meta.push(`risico: ${risks.join(', ')}`)
      return { id: c.id, label: caseLabel(identities.get(c.id)?.birthDate ?? null, c.gender), meta: meta.join(' · ') }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  // Artsen die je kunt toewijzen.
  const { data: team } = await admin
    .from('vh_medewerker').select('user_id, name').in('role', ['arts', 'leefstijlarts']).order('name')
  const artsen = (team ?? []).map(t => ({ userId: t.user_id as string, name: t.name as string }))

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
          Kies de dossiers waarvan zowel de vragenlijst als de biomarkeruitslag beschikbaar is en wijs de artsen toe.
        </p>
      </div>

      <RondeForm options={options} artsen={artsen} />

      {(rounds ?? []).length > 0 && (
        <section className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-[#1e293b]">Recente rondes</h2>
            <p className="mt-0.5 text-xs text-[#94a3b8]">Open een ronde om annotaties naar de trainingsmodule te zetten.</p>
          </div>
          <ul className="divide-y divide-[#f1f5f9]">
            {(rounds ?? []).map(r => {
              const count = Array.isArray(r.vh_annotation_case) ? r.vh_annotation_case.length : 0
              return (
                <li key={r.id}>
                  <Link href={`/admin/ronde/${r.id}`} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-[#f8fafc] transition-colors">
                    <span className="font-medium text-[#1e293b]">{r.title}</span>
                    <span className="flex items-center gap-3 text-xs text-[#94a3b8]">
                      <span>{count} casus{count === 1 ? '' : 'sen'}</span>
                      <span>{formatDate(r.created_at)}</span>
                      <span className={`rounded-full border px-2 py-0.5 font-medium ${r.status === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                        {r.status === 'open' ? 'Open' : 'Gesloten'}
                      </span>
                      <ChevronRight size={14} className="text-[#cbd5e1]" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
