import { createAdminClient } from '@/lib/supabase/admin'
import { favorability, markerAttention } from '@/lib/health-scoring'
import type { KnowledgeDomain } from '@/lib/knowledge-domains'

// Deterministische prioritering van aandachtspunten voor de adviesgeneratie.
// De selectie van "wat is het belangrijkst" ligt bewust in code (uitlegbaar,
// auditeerbaar, reproduceerbaar) — het taalmodel formuleert alleen het advies.
//
// Weging (hoog → laag):
//   ziekterisico "opvallend hoger"      100
//   ziekterisico "hoger dan gemiddeld"   85
//   afwijkende biomarker                 60 + afwijking t.o.v. optimaal (max +25)
//   leefstijlscore (gunstigheid f ≤ 5)   30 + (5 − f) × 8   → f=1 geeft 62
//   ja-antwoord op risicovraag           45 (Middelengebruik: 65)

export type PriorityKind = 'ziekterisico' | 'biomarker' | 'leefstijl'

export interface Priority {
  titel:  string
  detail: string
  domain: KnowledgeDomain | null
  weight: number
  kind:   PriorityKind
}

export interface ClientPriorities {
  priorities: Priority[]
  hasData: boolean
}

interface Q {
  id: string; type: string; label: string; category?: string | null
  reversed?: boolean; min?: number; max?: number; role?: string
  options?: { value: string; label: string }[]
}

export const DISEASE_LABELS: Record<string, string> = {
  heart_attack: 'hartaanval', ischemic_stroke: 'herseninfarct', type2_diabetes: 'diabetes type 2',
  chronic_kidney_disease: 'chronische nierziekte', fatty_liver_disease: 'leververvetting',
}
const DISEASE = DISEASE_LABELS

const nl = (n: number | null | undefined) => (n == null ? '—' : String(n).replace('.', ','))

// Vragenlijst-categorie → kennisdomein (vh_knowledge.domain). Substring-match op
// de categorienaam; onbekende categorieën krijgen geen domeinfilter.
const CATEGORY_DOMAIN: [string, KnowledgeDomain][] = [
  ['beweging', 'beweging'],
  ['voeding',  'voeding'],
  ['slaap',    'slaap'],
  ['stress',   'stress'],
  ['middelen', 'middelen'],
  ['sociale',  'sociaal'],
  ['balans',   'stress'],
]

export function domainForCategory(category: string | null | undefined): KnowledgeDomain | null {
  if (!category) return null
  const c = category.toLowerCase()
  for (const [needle, domain] of CATEGORY_DOMAIN) if (c.includes(needle)) return domain
  return null
}

export async function buildClientPriorities(clientId: string): Promise<ClientPriorities> {
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
    .select('vh_report_disease_risk(disease, result_category, risk_current_pct), vh_report_biomarker(marker_code, value, value_qualifier, unit, ref_optimal)')
    .eq('client_id', clientId).order('sample_date', { ascending: false }).limit(1).maybeSingle()

  const { data: refs } = await admin.from('vh_biomarker_ref').select('code, display_name, direction')
  const refByCode = new Map((refs ?? []).map((r: { code: string; display_name: string; direction: string | null }) => [r.code, r]))

  const priorities: Priority[] = []

  // ── Ziekterisico's ───────────────────────────────────────────────────────────
  const dis = (rep?.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null; risk_current_pct: number | null }[]
  for (const d of dis) {
    if (!d.result_category || d.result_category === 'average_or_lower') continue
    const notably = d.result_category === 'notably_above_average'
    priorities.push({
      titel:  `Verhoogd risico op ${DISEASE[d.disease] ?? d.disease}`,
      detail: `risico ${nl(d.risk_current_pct)}% (${notably ? 'opvallend hoger' : 'hoger'} dan gemiddeld)`,
      domain: null,
      weight: notably ? 100 : 85,
      kind:   'ziekterisico',
    })
  }

  // ── Biomarkers ───────────────────────────────────────────────────────────────
  const bio = (rep?.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }[]
  for (const b of bio) {
    const ref = refByCode.get(b.marker_code)
    if (!markerAttention(b.value, b.ref_optimal, ref?.direction ?? null)) continue
    // Relatieve afwijking t.o.v. optimaal bepaalt de ernst-opslag (max +25).
    const rel = b.value != null && b.ref_optimal ? Math.abs(b.value - b.ref_optimal) / Math.abs(b.ref_optimal) : 0
    priorities.push({
      titel:  `${ref?.display_name ?? b.marker_code} wijkt af`,
      detail: `${b.value_qualifier ?? ''}${nl(b.value)}${b.unit ? ' ' + b.unit : ''} (optimaal ${nl(b.ref_optimal)})`,
      domain: null,
      weight: 60 + Math.min(25, Math.round(rel * 50)),
      kind:   'biomarker',
    })
  }

  // ── Leefstijl (vragenlijst) ──────────────────────────────────────────────────
  if (responses && questions.length) {
    for (const q of questions) {
      if (q.type === 'scale' || q.type === 'rating_10') {
        const f = favorability(q, responses[q.id])
        if (f !== null && f <= 5) {
          priorities.push({
            titel:  q.label.replace(/\s*\?$/, ''),
            detail: `score ${Math.round(f)}/10 (ongunstig)`,
            domain: domainForCategory(q.category),
            weight: 30 + (5 - Math.round(f)) * 8,
            kind:   'leefstijl',
          })
        }
      }
      if (q.type === 'boolean' && (responses[q.id] === true || responses[q.id] === 'true')) {
        const middelen = (q.category ?? '').toLowerCase().includes('middelen')
        priorities.push({
          titel:  q.label.replace(/\s*\?$/, ''),
          detail: 'ja',
          domain: domainForCategory(q.category),
          weight: middelen ? 65 : 45,
          kind:   'leefstijl',
        })
      }
    }
  }

  priorities.sort((a, b) => b.weight - a.weight)
  return { priorities, hasData: Boolean(responses || rep) }
}
