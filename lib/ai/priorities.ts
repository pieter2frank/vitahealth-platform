import { createAdminClient } from '@/lib/supabase/admin'
import { favorability, markerAttention } from '@/lib/health-scoring'
import type { KnowledgeDomain } from '@/lib/knowledge-domains'

// Deterministische prioritering van aandachtspunten voor de adviesgeneratie.
// De selectie van "wat is het belangrijkst" ligt bewust in code (uitlegbaar,
// auditeerbaar, reproduceerbaar) — het taalmodel formuleert alleen het advies.
//
// Basisweging (hoog → laag):
//   ziekterisico "opvallend hoger"      100
//   ziekterisico "hoger dan gemiddeld"   85 (50 bij absoluut risico < 1% — relatief!)
//   afwijkende biomarker                 60 + afwijking t.o.v. optimaal (max +25)
//   leefstijlscore (gunstigheid f ≤ 5)   30 + (5 − f) × 8   → f=1 geeft 62
//   ja-antwoord op risicovraag           45 (Middelengebruik: 65)
//
// Contextcorrecties volgens het interpretatiekader van de leefstijlarts
// ("Inzichten biomarkers + leefstijlvragenlijsten"):
//   · clusters boven losse markers — een afwijking die als enige in haar
//     fysiologische systeem staat weegt −20; ≥3 afwijkingen in één systeem +10
//     (ApoB houdt altijd vol gewicht: atherogene deeltjes gaan vóór LDL/HDL)
//   · sterk totaalbeeld (Resilience ≥ 85, geen "opvallend hoger"-risico) →
//     leefstijlsignalen +15, geïsoleerde biomarkers extra −10: de grootste
//     winst zit dan in herstel/slaap/stress, niet in cijfers corrigeren
//   · creatinine bij een sporter (sportvraag ≥ 4/5) −25: past bij spiermassa,
//     geen nierschade-signaal zonder eGFR/albuminurie

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

// Fysiologische systemen uit het interpretatiekader (§4): match op display_name.
const SYSTEM_KEYWORDS: [string, string][] = [
  ['glyca', 'ontsteking'],
  ['hba1c', 'glucose'], ['bcaa', 'glucose'], ['alanine', 'glucose'],
  ['leucine', 'glucose'], ['valine', 'glucose'], ['isoleucine', 'glucose'],
  ['triglycer', 'vetstofwisseling'], ['vldl', 'vetstofwisseling'],
  ['fatty acids', 'vetstofwisseling'], ['mufa', 'vetstofwisseling'], ['pufa', 'vetstofwisseling'],
  ['apob', 'lipoproteinen'], ['apolipoprotein', 'lipoproteinen'],
  ['ldl', 'lipoproteinen'], ['hdl', 'lipoproteinen'], ['cholesterol', 'lipoproteinen'],
  ['creatinine', 'nier'],
  ['omega', 'vetzuurkwaliteit'], ['dha', 'vetzuurkwaliteit'],
  ['la %', 'vetzuurkwaliteit'], ['sfa', 'vetzuurkwaliteit'],
]

function systemFor(displayName: string): string | null {
  const n = displayName.toLowerCase()
  for (const [needle, sys] of SYSTEM_KEYWORDS) if (n.includes(needle)) return sys
  return null
}

const isApoB = (name: string) => /apob|apolipoprotein b/i.test(name)

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
    .select('resilience_score, vh_report_disease_risk(disease, result_category, risk_current_pct), vh_report_biomarker(marker_code, value, value_qualifier, unit, ref_optimal)')
    .eq('client_id', clientId).order('sample_date', { ascending: false }).limit(1).maybeSingle()

  const { data: refs } = await admin.from('vh_biomarker_ref').select('code, display_name, direction')
  const refByCode = new Map((refs ?? []).map((r: { code: string; display_name: string; direction: string | null }) => [r.code, r]))

  const priorities: Priority[] = []

  // ── Context voor de wegingscorrecties ────────────────────────────────────────
  const dis = (rep?.vh_report_disease_risk ?? []) as { disease: string; result_category: string | null; risk_current_pct: number | null }[]
  const hasNotablyRisk = dis.some(d => d.result_category === 'notably_above_average')
  const resilience = (rep as { resilience_score?: number | null } | null)?.resilience_score ?? null
  // "Sterk totaalbeeld": hoge resilience zonder opvallend verhoogd risico (§8/§9).
  const strongProfile = resilience !== null && resilience >= 85 && !hasNotablyRisk
  // Sporter? Dan is verhoogde creatinine waarschijnlijk spiermassa (§10).
  let isSporter = false
  if (responses && questions.length) {
    const sportQ = questions.find(q => /sport of train/i.test(q.label))
    isSporter = sportQ ? Number(responses[sportQ.id]) >= 4 : false
  }

  // ── Ziekterisico's ───────────────────────────────────────────────────────────
  for (const d of dis) {
    if (!d.result_category || d.result_category === 'average_or_lower') continue
    const notably = d.result_category === 'notably_above_average'
    // Risico is relatief t.o.v. leeftijdsgenoten (§14): een "hoger dan gemiddeld"
    // met een klein absoluut risico is duiding waard, geen top-prioriteit.
    const tinyAbsolute = !notably && d.risk_current_pct !== null && d.risk_current_pct < 1
    priorities.push({
      titel:  `Verhoogd risico op ${DISEASE[d.disease] ?? d.disease}`,
      detail: `risico ${nl(d.risk_current_pct)}% (${notably ? 'opvallend hoger' : 'hoger'} dan gemiddeld)`,
      domain: null,
      weight: notably ? 100 : tinyAbsolute ? 50 : 85,
      kind:   'ziekterisico',
    })
  }

  // ── Biomarkers: eerst afwijkingen verzamelen, dan clusters wegen (§5/§6) ─────
  const bio = (rep?.vh_report_biomarker ?? []) as { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }[]
  const attention = bio
    .map(b => ({ b, ref: refByCode.get(b.marker_code) }))
    .filter(({ b, ref }) => markerAttention(b.value, b.ref_optimal, ref?.direction ?? null))
    .map(({ b, ref }) => ({ b, name: ref?.display_name ?? b.marker_code, system: systemFor(ref?.display_name ?? b.marker_code) }))

  const clusterSize = new Map<string, number>()
  for (const a of attention) if (a.system) clusterSize.set(a.system, (clusterSize.get(a.system) ?? 0) + 1)

  for (const { b, name, system } of attention) {
    // Relatieve afwijking t.o.v. optimaal bepaalt de ernst-opslag (max +25).
    const rel = b.value != null && b.ref_optimal ? Math.abs(b.value - b.ref_optimal) / Math.abs(b.ref_optimal) : 0
    let weight = 60 + Math.min(25, Math.round(rel * 50))
    const size = system ? (clusterSize.get(system) ?? 1) : 1
    const isolated = size <= 1
    if (!isApoB(name)) {  // ApoB houdt altijd vol gewicht (§11)
      if (isolated) weight -= 20
      if (size >= 3) weight += 10
      if (isolated && strongProfile) weight -= 10
    }
    if (system === 'nier' && isSporter) weight -= 25
    const clusterNote = size >= 3 ? `; onderdeel van cluster ${system} (${size} afwijkingen)` : isolated ? '; geïsoleerde afwijking' : ''
    priorities.push({
      titel:  `${name} wijkt af`,
      detail: `${b.value_qualifier ?? ''}${nl(b.value)}${b.unit ? ' ' + b.unit : ''} (optimaal ${nl(b.ref_optimal)})${clusterNote}`,
      domain: null,
      weight,
      kind:   'biomarker',
    })
  }

  // ── Leefstijl (vragenlijst) ──────────────────────────────────────────────────
  // Bij een sterk totaalbeeld zit de grootste winst in herstel/slaap/stress (§8).
  const lifestyleBoost = strongProfile ? 15 : 0
  if (responses && questions.length) {
    for (const q of questions) {
      if (q.type === 'scale' || q.type === 'rating_10') {
        const f = favorability(q, responses[q.id])
        if (f !== null && f <= 5) {
          // Toon de ruwe score (zoals in het casusdocument), niet de omgerekende
          // 1-10-gunstigheid — anders noemen prompt en casus verschillende getallen.
          const max = q.type === 'rating_10' ? 10 : (q.max ?? 5)
          priorities.push({
            titel:  q.label.replace(/\s*\?$/, ''),
            detail: `score ${Number(responses[q.id])}/${max} (ongunstig)`,
            domain: domainForCategory(q.category),
            weight: 30 + (5 - Math.round(f)) * 8 + lifestyleBoost,
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
          weight: (middelen ? 65 : 45) + lifestyleBoost,
          kind:   'leefstijl',
        })
      }
    }
  }

  priorities.sort((a, b) => b.weight - a.weight)
  return { priorities, hasData: Boolean(responses || rep) }
}
