import { createAdminClient } from '@/lib/supabase/admin'
import { favorability, calcBmi, markerAttention } from '@/lib/health-scoring'

// Server-side signaal-profiel van een cliënt: de outliers uit de intake-
// vragenlijst en de biomarker-uitslag, samengevat als tekst. Dit voedt zowel de
// advies-engine (als query + context) als toekomstige weergaven.

interface Q { id: string; type: string; label: string; category?: string | null; reversed?: boolean; min?: number; max?: number; role?: string; options?: { value: string; label: string }[] }

export interface ClientSignals { summaryText: string; hasData: boolean }

export async function buildClientSignals(clientId: string): Promise<ClientSignals> {
  const admin = createAdminClient()

  const { data: qr } = await admin
    .from('vh_questionnaire_response')
    .select('responses, questionnaire_id')
    .eq('client_id', clientId).order('completed_at', { ascending: false }).limit(1).maybeSingle()

  let questions: Q[] = []
  const responses = (qr?.responses as Record<string, unknown>) ?? null
  if (qr?.questionnaire_id) {
    const { data: qDef } = await admin.from('vh_questionnaire').select('json_content').eq('id', qr.questionnaire_id).single()
    questions = ((qDef?.json_content as { questions?: Q[] } | null)?.questions) ?? []
  }

  const { data: rep } = await admin
    .from('vh_report')
    .select('metabolic_age, resilience_score, projection_age, vh_report_disease_risk(disease, result_category, risk_current_pct), vh_report_biomarker(marker_code, value, value_qualifier, unit, ref_optimal)')
    .eq('client_id', clientId).order('sample_date', { ascending: false }).limit(1).maybeSingle()

  const { data: refs } = await admin.from('vh_biomarker_ref').select('code, display_name, direction')
  const refByCode = new Map((refs ?? []).map((r: { code: string; display_name: string; direction: string | null }) => [r.code, r]))

  const lines: string[] = []

  // Intake
  if (responses && questions.length) {
    const unfav = questions
      .filter(q => q.type === 'scale' || q.type === 'rating_10')
      .map(q => { const f = favorability(q, responses[q.id]); return f == null ? null : { label: q.label, f } })
      .filter((x): x is { label: string; f: number } => x !== null && x.f <= 5)
      .sort((a, b) => a.f - b.f)
    if (unfav.length) lines.push('Ongunstige leefstijlscores: ' + unfav.map(u => u.label).join('; ') + '.')

    for (const q of questions) {
      if (q.type === 'boolean' && (responses[q.id] === true || responses[q.id] === 'true')) lines.push(q.label)
      if (q.type === 'checkbox' && Array.isArray(responses[q.id])) {
        const vals = (responses[q.id] as string[]).filter(v => v !== 'geen')
        if (vals.length) lines.push(`${q.label.replace(/\?$/, '')}: ${vals.map(v => q.options?.find(o => o.value === v)?.label ?? v).join(', ')}`)
      }
    }
    const hQ = questions.find(q => q.role === 'height_cm'), wQ = questions.find(q => q.role === 'weight_kg')
    const bmi = hQ && wQ ? calcBmi(responses[hQ.id], responses[wQ.id]) : null
    if (bmi != null) lines.push(`BMI: ${bmi}`)
  }

  // Biomarkers
  if (rep) {
    if (rep.metabolic_age != null) lines.push(`Metabole leeftijd: ${rep.metabolic_age}`)
    if (rep.resilience_score != null) lines.push(`Metabolic Resilience Score: ${rep.resilience_score}/100`)
    const bio = (rep.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }[]
    const out = bio
      .filter(b => markerAttention(b.value, b.ref_optimal, refByCode.get(b.marker_code)?.direction ?? null))
      .map(b => `${refByCode.get(b.marker_code)?.display_name ?? b.marker_code} ${b.value_qualifier ?? ''}${b.value}${b.unit ? ' ' + b.unit : ''} (optimaal ${b.ref_optimal})`)
    if (out.length) lines.push('Afwijkende bloedwaarden: ' + out.join('; ') + '.')
    const dis = (rep.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null; risk_current_pct: number | null }[]
    const disOut = dis.filter(x => x.result_category && x.result_category !== 'average_or_lower').map(x => x.disease)
    if (disOut.length) lines.push('Verhoogd risico: ' + disOut.join(', ') + '.')
  }

  return { summaryText: lines.join('\n') || 'Geen bijzondere signalen gevonden.', hasData: Boolean(responses || rep) }
}
