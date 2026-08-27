import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentity } from '@/lib/pii/identity'
import { favorability, calcBmi, bmiLabel, ageFrom, markerStatus } from '@/lib/health-scoring'
import { systemFor, SYSTEM_LABELS } from '@/lib/ai/priorities'

// Gestructureerde casusweergave voor het annotatiescherm: dezelfde inhoud als
// buildClientCaseText, maar per item met een status (kleur) zodat de arts in één
// oogopslag ziet waar iemand groen/oranje/rood scoort. De platte-tekstversie
// (buildClientCaseText) blijft bestaan voor de trainingsupload.

export type ItemStatus = 'good' | 'warn' | 'alert' | 'neutral'
export interface CaseItem { text: string; status: ItemStatus; group?: string }
export interface CaseSection { heading: string; items: CaseItem[] }

// Kerngetallen voor het MDO-scoreboard (grote tegels).
export interface CaseStats {
  age:              number | null
  metabolicAge:     number | null
  metabolicStatus:  ItemStatus
  resilience:       number | null
  resilienceStatus: ItemStatus
  bmi:              number | null
  bmiLabel:         string | null
  bmiStatus:        ItemStatus
  projectionAge:    number | null
  topRisk:          { label: string; pct: number | null; notably: boolean } | null
}

export interface StructuredCase { title: string; sections: CaseSection[]; stats: CaseStats; hasData: boolean }

interface Q {
  id: string; type: string; label: string; category?: string | null
  reversed?: boolean; min?: number; max?: number; role?: string
  unit?: string; options?: { value: string; label: string }[]
}
const nl = (n: number | null | undefined) => (n == null ? '—' : String(n).replace('.', ','))
const GENDER: Record<string, string> = { man: 'man', vrouw: 'vrouw', anders: 'anders', zeg_liever_niet: 'geslacht onbekend' }
const DISEASE: Record<string, string> = {
  heart_attack: 'Hartaanval', ischemic_stroke: 'Herseninfarct', type2_diabetes: 'Diabetes type 2',
  chronic_kidney_disease: 'Chronische nierziekte', fatty_liver_disease: 'Leververvetting',
}
const CAT: Record<string, string> = { higher_than_average: 'hoger dan gemiddeld', notably_above_average: 'opvallend hoger' }

function answerText(q: Q, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (q.type === 'scale' || q.type === 'rating_10') { const max = q.type === 'rating_10' ? 10 : (q.max ?? 5); return `${Number(raw)}/${max}` }
  if (q.type === 'boolean') return (raw === true || raw === 'true') ? 'ja' : 'nee'
  if (q.type === 'checkbox' && Array.isArray(raw)) {
    const vals = raw as string[]; if (!vals.length) return null
    return vals.map(v => q.options?.find(o => o.value === v)?.label ?? v).join(', ')
  }
  if ((q.type === 'radio' || q.type === 'select') && q.options) return q.options.find(o => o.value === raw)?.label ?? String(raw)
  const s = String(raw).trim(); return s ? (q.unit ? `${s} ${q.unit}` : s.slice(0, 400)) : null
}

const favStatus = (fav: number | null): ItemStatus =>
  fav == null ? 'neutral' : fav >= 7 ? 'good' : fav >= 4 ? 'warn' : 'alert'

function markerColor(value: number | null, optimal: number | null, direction: string | null): ItemStatus {
  const st = markerStatus(value, optimal, direction)
  if (st === 'good') return 'good'
  if (st === 'neutral') return 'neutral'
  if (value != null && optimal != null && optimal !== 0) {
    return Math.abs(value - optimal) / Math.abs(optimal) > 0.2 ? 'alert' : 'warn'
  }
  return 'warn'
}

const bmiStatus = (bmi: number): ItemStatus => {
  const l = bmiLabel(bmi)
  return l === 'normaal' ? 'good' : l === 'overgewicht' ? 'warn' : 'alert'
}
const metAgeStatus = (metabolic: number | null, age: number | null): ItemStatus => {
  if (metabolic == null || age == null) return 'neutral'
  const d = metabolic - age
  return d <= 0 ? 'good' : d <= 5 ? 'warn' : 'alert'
}
const resilienceStatus = (s: number | null): ItemStatus =>
  s == null ? 'neutral' : s >= 70 ? 'good' : s >= 40 ? 'warn' : 'alert'

export async function buildClientCaseStructured(clientId: string): Promise<StructuredCase> {
  const admin = createAdminClient()

  // Fase 2 PII-kluis: geboortedatum via de toegangslaag; geslacht blijft op vh_client.
  const [{ data: client }, identity] = await Promise.all([
    admin.from('vh_client').select('gender').eq('id', clientId).maybeSingle(),
    getIdentity(admin, clientId),
  ])
  const age = ageFrom(identity?.birthDate ?? null)
  const gender = client?.gender ? (GENDER[client.gender] ?? client.gender) : null

  const { data: qr } = await admin
    .from('vh_questionnaire_response').select('responses, questionnaire_id')
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

  // ── Kenmerken ────────────────────────────────────────────────────────────────
  const heightQ = questions.find(q => q.role === 'height_cm')
  const weightQ = questions.find(q => q.role === 'weight_kg')
  const bmi = responses && heightQ && weightQ ? calcBmi(responses[heightQ.id], responses[weightQ.id]) : null

  const kenmerken: CaseItem[] = []
  if (age != null)   kenmerken.push({ text: `Leeftijd: ${age} jaar`, status: 'neutral' })
  if (gender)        kenmerken.push({ text: `Geslacht: ${gender}`, status: 'neutral' })
  if (bmi != null)   kenmerken.push({ text: `BMI: ${nl(bmi)} (${bmiLabel(bmi)})`, status: bmiStatus(bmi) })
  if (rep?.metabolic_age != null)    kenmerken.push({ text: `Metabole leeftijd: ${rep.metabolic_age} jaar`, status: metAgeStatus(rep.metabolic_age, age) })
  if (rep?.resilience_score != null) kenmerken.push({ text: `Metabolic Resilience Score: ${rep.resilience_score}/100`, status: resilienceStatus(rep.resilience_score) })
  if (rep?.projection_age != null)   kenmerken.push({ text: `Projectieleeftijd: ${rep.projection_age} jaar`, status: 'neutral' })

  // ── Vragenlijst ────────────────────────────────────────────────────────────────
  const vragenlijst: CaseItem[] = []
  if (responses && questions.length) {
    for (const q of questions) {
      if (q.role === 'height_cm' || q.role === 'weight_kg') continue
      const a = answerText(q, responses[q.id])
      if (!a) continue
      const status = favStatus(favorability(q, responses[q.id]))
      vragenlijst.push({ text: `${q.label.replace(/\s*\?$/, '')}: ${a}`, status, group: q.category ?? 'Overig' })
    }
  }

  // ── Biomarkers ──────────────────────────────────────────────────────────────────
  const biomarkers: CaseItem[] = []
  const bio = (rep?.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }[]
  for (const b of bio) {
    const ref = refByCode.get(b.marker_code)
    const name = ref?.display_name ?? b.marker_code
    const opt = b.ref_optimal != null ? `, optimaal ${nl(b.ref_optimal)}` : ''
    const sys = systemFor(name)
    biomarkers.push({
      text: `${name}: ${b.value_qualifier ?? ''}${nl(b.value)}${b.unit ? ' ' + b.unit : ''}${opt}`,
      status: markerColor(b.value, b.ref_optimal, ref?.direction ?? null),
      group: sys ? (SYSTEM_LABELS[sys] ?? sys) : 'Overig',
    })
  }

  const dis = (rep?.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null; risk_current_pct: number | null }[]
  const ziekterisico: CaseItem[] = dis
    .filter(x => x.result_category && x.result_category !== 'average_or_lower')
    .map(x => ({
      text: `${DISEASE[x.disease] ?? x.disease}: ${nl(x.risk_current_pct)}%${x.result_category ? ` (${CAT[x.result_category] ?? x.result_category})` : ''}`,
      status: (x.result_category === 'notably_above_average' ? 'alert' : 'warn') as ItemStatus,
    }))

  const titleBits = [age != null ? `${age}-jarige` : null, gender].filter(Boolean).join(' ')
  const sections: CaseSection[] = [
    { heading: 'Kenmerken', items: kenmerken.length ? kenmerken : [{ text: '(geen gegevens)', status: 'neutral' }] },
    { heading: 'Vragenlijst — uitkomsten', items: vragenlijst.length ? vragenlijst : [{ text: '(geen intake beschikbaar)', status: 'neutral' }] },
    { heading: 'Biomarkers — uitkomsten', items: biomarkers.length ? biomarkers : [{ text: '(geen uitslag beschikbaar)', status: 'neutral' }] },
  ]
  if (ziekterisico.length) sections.push({ heading: 'Verhoogd ziekterisico', items: ziekterisico })

  // Hoogste ziekterisico voor de scoreboard-tegel: eerst "opvallend hoger",
  // daarbinnen het hoogste percentage.
  const elevated = dis
    .filter(x => x.result_category && x.result_category !== 'average_or_lower')
    .sort((a, b) =>
      Number(b.result_category === 'notably_above_average') - Number(a.result_category === 'notably_above_average') ||
      (b.risk_current_pct ?? 0) - (a.risk_current_pct ?? 0))
  const stats: CaseStats = {
    age,
    metabolicAge:     rep?.metabolic_age ?? null,
    metabolicStatus:  metAgeStatus(rep?.metabolic_age ?? null, age),
    resilience:       rep?.resilience_score ?? null,
    resilienceStatus: resilienceStatus(rep?.resilience_score ?? null),
    bmi,
    bmiLabel:         bmi != null ? bmiLabel(bmi) : null,
    bmiStatus:        bmi != null ? bmiStatus(bmi) : 'neutral',
    projectionAge:    rep?.projection_age ?? null,
    topRisk: elevated.length
      ? {
          label:   DISEASE[elevated[0].disease] ?? elevated[0].disease,
          pct:     elevated[0].risk_current_pct,
          notably: elevated[0].result_category === 'notably_above_average',
        }
      : null,
  }

  return { title: `Casus — ${titleBits || 'cliënt'}`, sections, stats, hasData: Boolean(responses || rep) }
}
