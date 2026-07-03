import { createAdminClient } from '@/lib/supabase/admin'

// Stelt een GEPSEUDONIMISEERD casusdocument samen uit het dossier: kenmerken,
// vragenlijst-uitkomsten en biomarker-uitslag. GEEN naam/adres/e-mail/telefoon,
// GEEN geboortejaar — wél de (berekende) leeftijd. Bedoeld als trainingsinput;
// de arts vult zelf het advies aan en controleert vóór upload.

interface Q {
  id: string; type: string; label: string; category?: string | null
  reversed?: boolean; min?: number; max?: number; role?: string
  unit?: string; options?: { value: string; label: string }[]
}

function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth); if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}
function toTen(q: Q, v: number): number | null {
  if (Number.isNaN(v)) return null
  if (q.type === 'rating_10') return v
  if (q.type === 'scale') { const mn = q.min ?? 1, mx = q.max ?? 5; return mx === mn ? null : ((v - mn) / (mx - mn)) * 9 + 1 }
  return null
}
function favorability(q: Q, raw: unknown): number | null {
  const t = toTen(q, Number(raw)); if (t === null) return null
  return q.reversed ? 11 - t : t
}
function calcBmi(h: unknown, w: unknown): number | null {
  const hh = Number(h), ww = Number(w)
  if (!hh || !ww || hh < 50 || ww < 10) return null
  return Math.round((ww / (hh / 100) ** 2) * 10) / 10
}
function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'ondergewicht'
  if (bmi < 25) return 'normaal'
  if (bmi < 30) return 'overgewicht'
  return 'obesitas'
}
function markerAttention(value: number | null, optimal: number | null, direction: string | null): boolean {
  if (value == null || optimal == null || !direction) return false
  if (direction === 'lower_better')  return value > optimal
  if (direction === 'higher_better') return value < optimal
  return false
}
const nl = (n: number | null | undefined) => (n == null ? '—' : String(n).replace('.', ','))

const GENDER: Record<string, string> = {
  man: 'man', vrouw: 'vrouw', anders: 'anders', zeg_liever_niet: 'geslacht onbekend',
}
const DISEASE: Record<string, string> = {
  heart_attack: 'Hartaanval', ischemic_stroke: 'Herseninfarct', type2_diabetes: 'Diabetes type 2',
  chronic_kidney_disease: 'Chronische nierziekte', fatty_liver_disease: 'Leververvetting',
}
const CAT: Record<string, string> = {
  higher_than_average: 'hoger dan gemiddeld', notably_above_average: 'opvallend hoger',
}

// Rendert het antwoord op één vraag als leesbare tekst (of null om over te slaan).
function renderAnswer(q: Q, raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (q.type === 'scale' || q.type === 'rating_10') {
    const max = q.type === 'rating_10' ? 10 : (q.max ?? 5)
    const fav = favorability(q, raw)
    const flag = fav !== null && fav <= 5 ? ' — aandacht' : ''
    return `${Number(raw)}/${max}${flag}`
  }
  if (q.type === 'boolean') return (raw === true || raw === 'true') ? 'ja' : 'nee'
  if (q.type === 'checkbox' && Array.isArray(raw)) {
    const vals = (raw as string[])
    if (!vals.length) return null
    return vals.map(v => q.options?.find(o => o.value === v)?.label ?? v).join(', ')
  }
  if ((q.type === 'radio' || q.type === 'select') && q.options) {
    return q.options.find(o => o.value === raw)?.label ?? String(raw)
  }
  const s = String(raw).trim()
  return s ? (q.unit ? `${s} ${q.unit}` : s.slice(0, 400)) : null
}

export interface CaseDoc { text: string; title: string; hasData: boolean }

export async function buildClientCaseText(clientId: string): Promise<CaseDoc> {
  const admin = createAdminClient()

  const { data: client } = await admin
    .from('vh_client').select('gender, birth_date').eq('id', clientId).maybeSingle()
  const age = ageFrom(client?.birth_date ?? null)
  const gender = client?.gender ? (GENDER[client.gender] ?? client.gender) : null

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

  // ── Kenmerken ────────────────────────────────────────────────────────────────
  const heightQ = questions.find(q => q.role === 'height_cm')
  const weightQ = questions.find(q => q.role === 'weight_kg')
  const bmi = responses && heightQ && weightQ ? calcBmi(responses[heightQ.id], responses[weightQ.id]) : null

  const kenmerken: string[] = []
  if (age != null)   kenmerken.push(`- Leeftijd: ${age} jaar`)
  if (gender)        kenmerken.push(`- Geslacht: ${gender}`)
  if (bmi != null)   kenmerken.push(`- BMI: ${nl(bmi)} (${bmiLabel(bmi)})`)
  if (rep?.metabolic_age != null)    kenmerken.push(`- Metabole leeftijd: ${rep.metabolic_age} jaar`)
  if (rep?.resilience_score != null) kenmerken.push(`- Metabolic Resilience Score: ${rep.resilience_score}/100`)
  if (rep?.projection_age != null)   kenmerken.push(`- Projectieleeftijd: ${rep.projection_age} jaar`)

  // ── Vragenlijst — uitkomsten ──────────────────────────────────────────────────
  const vragenlijst: string[] = []
  if (responses && questions.length) {
    for (const q of questions) {
      if (q.role === 'height_cm' || q.role === 'weight_kg') continue // al in kenmerken/BMI
      const a = renderAnswer(q, responses[q.id])
      if (a) vragenlijst.push(`- ${q.label.replace(/\s*\?$/, '')}: ${a}`)
    }
  }

  // ── Biomarkers — uitkomsten ───────────────────────────────────────────────────
  const biomarkers: string[] = []
  const bio = (rep?.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }[]
  for (const b of bio) {
    const ref = refByCode.get(b.marker_code)
    const name = ref?.display_name ?? b.marker_code
    const attention = markerAttention(b.value, b.ref_optimal, ref?.direction ?? null)
    const opt = b.ref_optimal != null ? `, optimaal ${nl(b.ref_optimal)}` : ''
    biomarkers.push(`- ${name}: ${b.value_qualifier ?? ''}${nl(b.value)}${b.unit ? ' ' + b.unit : ''}${opt}${attention ? ' — aandacht' : ''}`)
  }
  const dis = (rep?.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null; risk_current_pct: number | null }[]
  const ziekterisico = dis
    .filter(x => x.result_category && x.result_category !== 'average_or_lower')
    .map(x => `- ${DISEASE[x.disease] ?? x.disease}: ${nl(x.risk_current_pct)}%${x.result_category ? ` (${CAT[x.result_category] ?? x.result_category})` : ''}`)

  // ── Samenstellen ──────────────────────────────────────────────────────────────
  const titleBits = [age != null ? `${age}-jarige` : null, gender].filter(Boolean).join(' ')
  const title = `Casus — ${titleBits || 'cliënt'}`

  const parts: string[] = [`## ${title}`, '']
  parts.push('### Kenmerken', kenmerken.length ? kenmerken.join('\n') : '- (geen gegevens)', '')
  parts.push('### Vragenlijst — uitkomsten', vragenlijst.length ? vragenlijst.join('\n') : '- (geen intake beschikbaar)', '')
  parts.push('### Biomarkers — uitkomsten', biomarkers.length ? biomarkers.join('\n') : '- (geen uitslag beschikbaar)')
  if (ziekterisico.length) parts.push('', '### Verhoogd ziekterisico', ziekterisico.join('\n'))

  return {
    text: parts.join('\n'),
    title,
    hasData: Boolean(responses || rep),
  }
}
