import { createAdminClient } from '@/lib/supabase/admin'
import { getIdentity } from '@/lib/pii/identity'
import { calcBmi, ageFrom, markerAttention } from '@/lib/health-scoring'

// Evalueert de als-dan richtlijnen (vh_advice_rule) deterministisch tegen het
// dossier van één cliënt. Matchende regels leveren hun instructie op voor de
// adviesprompt. Onbekende/ontbrekende gegevens laten een conditie falen — een
// regel vuurt dus alleen als álle condities aantoonbaar waar zijn.

export interface MatchedRule {
  id: string
  name: string
  instruction: string
  domain: string | null
}

export type Cond = {
  kind: 'biomarker' | 'question' | 'disease' | 'bmi' | 'age' | 'gender' | 'resilience'
  code?: string; qid?: string
  op?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'attention' | 'elevated'
  value?: unknown
}

const NUM_OPS = ['gt', 'gte', 'lt', 'lte'] as const

// Valideert conditie-invoer uit de beheer-UI naar een veilige, bekende vorm.
// Geeft null terug bij ongeldige invoer (API weigert dan de hele regel).
export function sanitizeConditions(input: unknown): Cond[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10) return null
  const out: Cond[] = []
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) return null
    const c = raw as Record<string, unknown>
    const str = (v: unknown, max = 120) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
    const numeric = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null)
    switch (c.kind) {
      case 'biomarker': {
        const code = str(c.code)
        if (!code) return null
        if (c.op === 'attention') { out.push({ kind: 'biomarker', code, op: 'attention' }); break }
        const v = numeric(c.value)
        if (!NUM_OPS.includes(c.op as typeof NUM_OPS[number]) || v === null) return null
        out.push({ kind: 'biomarker', code, op: c.op as Cond['op'], value: v })
        break
      }
      case 'question': {
        const qid = str(c.qid)
        if (!qid) return null
        if (c.op === 'eq') {
          const v = typeof c.value === 'boolean' ? c.value : str(c.value)
          if (v === null) return null
          out.push({ kind: 'question', qid, op: 'eq', value: v })
          break
        }
        const v = numeric(c.value)
        if ((c.op !== 'gte' && c.op !== 'lte') || v === null) return null
        out.push({ kind: 'question', qid, op: c.op, value: v })
        break
      }
      case 'disease': {
        const code = str(c.code)
        if (!code) return null
        out.push({ kind: 'disease', code, op: 'elevated' })
        break
      }
      case 'bmi': case 'age': case 'resilience': {
        const v = numeric(c.value)
        if (!NUM_OPS.includes(c.op as typeof NUM_OPS[number]) || v === null) return null
        out.push({ kind: c.kind, op: c.op as Cond['op'], value: v })
        break
      }
      case 'gender': {
        const v = str(c.value, 30)
        if (!v) return null
        out.push({ kind: 'gender', value: v })
        break
      }
      default: return null
    }
  }
  return out
}

interface RuleRow { id: string; name: string; instruction: string; domain: string | null; conditions: unknown }

function num(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function compare(actual: number, op: string | undefined, expected: unknown): boolean {
  const e = num(expected)
  if (e === null) return false
  switch (op) {
    case 'gt':  return actual > e
    case 'gte': return actual >= e
    case 'lt':  return actual < e
    case 'lte': return actual <= e
    case 'eq':  return actual === e
    default:    return false
  }
}

export async function evaluateAdviceRules(clientId: string): Promise<MatchedRule[]> {
  const admin = createAdminClient()

  // Regels ophalen; tabel kan nog ontbreken zolang migratie 081 niet is gedraaid.
  let rules: RuleRow[] = []
  try {
    const { data, error } = await admin
      .from('vh_advice_rule')
      .select('id, name, instruction, domain, conditions')
      .eq('active', true)
    if (error) return []
    rules = (data ?? []) as RuleRow[]
  } catch {
    return []
  }
  if (rules.length === 0) return []

  // Dossiergegevens één keer ophalen.
  const [{ data: client }, identity, { data: qr }, { data: rep }, { data: refs }] = await Promise.all([
    admin.from('vh_client').select('gender').eq('id', clientId).maybeSingle(),
    getIdentity(admin, clientId),
    admin.from('vh_questionnaire_response')
      .select('responses, questionnaire_id')
      .eq('client_id', clientId).order('completed_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('vh_report')
      .select('resilience_score, vh_report_disease_risk(disease, result_category), vh_report_biomarker(marker_code, value, ref_optimal)')
      .eq('client_id', clientId).order('sample_date', { ascending: false }).limit(1).maybeSingle(),
    admin.from('vh_biomarker_ref').select('code, direction'),
  ])

  const age = ageFrom(identity?.birthDate ?? null)
  const gender = (client as { gender: string | null } | null)?.gender ?? null
  const responses = (qr?.responses as Record<string, unknown> | null) ?? null

  const bio = new Map<string, { value: number | null; ref_optimal: number | null }>()
  for (const b of ((rep?.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; ref_optimal: number | null }[])) {
    bio.set(b.marker_code, b)
  }
  const direction = new Map((refs ?? []).map((r: { code: string; direction: string | null }) => [r.code, r.direction]))
  const disease = new Map<string, string | null>()
  for (const d of ((rep?.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null }[])) {
    disease.set(d.disease, d.result_category)
  }

  // BMI uit de vragenlijst (zelfde route als het casusdocument).
  let bmi: number | null = null
  if (responses && qr?.questionnaire_id) {
    const { data: qDef } = await admin.from('vh_questionnaire').select('json_content').eq('id', qr.questionnaire_id).single()
    const questions = ((qDef?.json_content as { questions?: { id: string; role?: string }[] } | null)?.questions) ?? []
    const hQ = questions.find(q => q.role === 'height_cm'), wQ = questions.find(q => q.role === 'weight_kg')
    bmi = hQ && wQ ? calcBmi(responses[hQ.id], responses[wQ.id]) : null
  }

  function holds(c: Cond): boolean {
    switch (c.kind) {
      case 'biomarker': {
        const b = c.code ? bio.get(c.code) : undefined
        if (!b || b.value == null) return false
        if (c.op === 'attention') return markerAttention(b.value, b.ref_optimal, direction.get(c.code!) ?? null)
        return compare(b.value, c.op, c.value)
      }
      case 'question': {
        if (!responses || !c.qid || !(c.qid in responses)) return false
        const raw = responses[c.qid]
        if (c.op === 'eq') {
          if (typeof c.value === 'boolean') return (raw === true || raw === 'true') === c.value
          return String(raw) === String(c.value)
        }
        const n = num(raw)
        return n !== null && compare(n, c.op, c.value)
      }
      case 'disease': {
        const cat = c.code ? disease.get(c.code) : undefined
        return Boolean(cat && cat !== 'average_or_lower') // op 'elevated'
      }
      case 'bmi':    return bmi !== null && compare(bmi, c.op, c.value)
      case 'age':    return age !== null && compare(age, c.op, c.value)
      case 'resilience': {
        const score = (rep as { resilience_score?: number | null } | null)?.resilience_score ?? null
        return score !== null && compare(score, c.op, c.value)
      }
      case 'gender': return gender !== null && gender === c.value
      default:       return false
    }
  }

  const matched: MatchedRule[] = []
  for (const r of rules) {
    const conds = Array.isArray(r.conditions) ? (r.conditions as Cond[]) : []
    if (conds.length === 0) continue // regel zonder condities vuurt nooit
    if (conds.every(holds)) matched.push({ id: r.id, name: r.name, instruction: r.instruction, domain: r.domain })
  }
  return matched
}
