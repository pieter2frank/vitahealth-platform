// Parser voor het Nightingale Health Check klinisch rapport.
// Verwerkt alleen de NETTE tabellen: paginakop (metadata), topscores,
// ziekterisico's en de bloedmarker-associatietabellen. Grafiekpagina's worden
// overgeslagen (gate op de tabel-header "respect to the score").
//
// De parser is puur (regels in → gestructureerde data uit) en daarmee testbaar.

export interface ParsedMeta {
  sex: 'male' | 'female' | null
  age: number | null
  sampleId: string | null
  sampleDate: string | null      // ISO yyyy-mm-dd
}
export interface ParsedScores {
  metabolicAge: number | null
  resilienceScore: number | null
  resiliencePercentile: number | null
  resilienceCategory: string | null
}
export interface ParsedDisease {
  disease: string
  resultCategory: string | null
  riskCurrentPct: number | null
  riskAvgPct: number | null
  riskAge70Pct: number | null
  riskAge70AvgPct: number | null
}
export interface ParsedBiomarker {
  markerCode: string
  value: number
  unit: string | null
  refOptimal: number | null
  association: 'strongest' | 'moderate' | 'weakest'
}
export interface ParsedReport {
  meta: ParsedMeta
  scores: ParsedScores
  diseases: ParsedDisease[]
  biomarkers: ParsedBiomarker[]
  warnings: string[]
}

// Bekende bloedmarkers (genormaliseerde weergavenaam → canonieke code, zie vh_biomarker_ref).
const MARKERS: Record<string, string> = {
  'total cholesterol': 'total_cholesterol', 'ldl cholesterol': 'ldl_cholesterol',
  'hdl cholesterol': 'hdl_cholesterol', 'vldl cholesterol': 'vldl_cholesterol',
  'apolipoprotein b': 'apob', 'apolipoprotein a1': 'apoa1', 'apob/apoa1': 'apob_apoa1',
  'total triglycerides': 'total_triglycerides', 'glycoprotein acetyls': 'glyca', 'hba1c': 'hba1c',
  'total fatty acids': 'total_fatty_acids', 'omega-6 %': 'omega6_pct', 'omega-3 %': 'omega3_pct',
  'omega-6/omega-3': 'omega6_omega3', 'pufa %': 'pufa_pct', 'mufa %': 'mufa_pct',
  'pufa/mufa': 'pufa_mufa', 'sfa %': 'sfa_pct', 'la %': 'la_pct', 'dha %': 'dha_pct',
  'creatinine': 'creatinine', 'alanine': 'alanine', 'leucine': 'leucine', 'valine': 'valine',
  'isoleucine': 'isoleucine', 'total bcaas': 'total_bcaa',
}
const DISEASES: Record<string, string> = {
  'heart attack': 'heart_attack', 'ischemic stroke': 'ischemic_stroke',
  'type 2 diabetes': 'type2_diabetes', 'chronic kidney disease': 'chronic_kidney_disease',
  'fatty liver disease': 'fatty_liver_disease',
}
const CATEGORIES: Record<string, string> = {
  'average or lower': 'average_or_lower', 'higher than average': 'higher_than_average',
  'notably above average': 'notably_above_average',
}
const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

// Eenheid accepteert beide mu-varianten (µ U+00B5 en μ U+03BC) voor µmol/L.
const VALUE_RE = /^(\d+(?:\.\d+)?)\s*(mmol\/L|g\/L|mmol\/mol|[µμ]mol\/L|mol\/L|ratio|%)$/
const REF_RE   = /^[≤≥]\s*(\d+(?:\.\d+)?)$/

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const fixUnit = (u: string | null) => (u ? u.replace('μ', 'µ') : u)   // normaliseer Griekse mu

export function parseNightingaleReport(pages: string[][]): ParsedReport {
  const out: ParsedReport = {
    meta:   { sex: null, age: null, sampleId: null, sampleDate: null },
    scores: { metabolicAge: null, resilienceScore: null, resiliencePercentile: null, resilienceCategory: null },
    diseases: [],
    biomarkers: [],
    warnings: [],
  }

  // Metadata uit de paginakop (staat op elke pagina).
  for (const pg of pages) {
    let done = false
    for (const ln of pg) {
      const m = ln.match(/^(Male|Female),\s*(\d+)\s+(\d+)\s+(\d{2}) (\w{3}) (\d{4})/)
      if (m) {
        out.meta = {
          sex: m[1].toLowerCase() as 'male' | 'female',
          age: Number(m[2]),
          sampleId: m[3],
          sampleDate: MONTHS[m[5]] ? `${m[6]}-${MONTHS[m[5]]}-${m[4]}` : null,
        }
        done = true; break
      }
    }
    if (done) break
  }

  for (const pg of pages) {
    const joined = pg.join('\n').toLowerCase()

    // ── Metabolic Age ──
    if (joined.includes('metabolic age') && joined.includes('your current metabolic age')) {
      const idx = pg.findIndex(l => /your current metabolic age/i.test(l))
      for (let i = idx - 1; i >= 0 && i >= idx - 5; i--) {
        const mm = pg[i].match(/^(\d{2,3})$/)
        if (mm) { out.scores.metabolicAge = Number(mm[1]); break }
      }
    }

    // ── Metabolic Resilience Score ──
    if (joined.includes('metabolic resilience score')) {
      const sc = pg.find(l => /^\d+ \/ 100$/.test(l))
      if (sc) out.scores.resilienceScore = Number(sc.split('/')[0].trim())
      const pc = pg.find(l => /^\d+ % \d+ %$/.test(l))
      if (pc) out.scores.resiliencePercentile = Number(pc.match(/^(\d+) %/)![1])
      const cat = pg.find(l => ['above average', 'below average', 'poor', 'excellent'].includes(norm(l)))
      if (cat) out.scores.resilienceCategory = norm(cat).replace(/\s+/g, '_')
    }

    // ── Ziektepagina ──
    const diseaseLine = pg.slice(0, 6).map(norm).find(l => DISEASES[l])
    if (diseaseLine && joined.includes('your current result category')) {
      const d: ParsedDisease = {
        disease: DISEASES[diseaseLine],
        resultCategory: null, riskCurrentPct: null, riskAvgPct: null,
        riskAge70Pct: null, riskAge70AvgPct: null,
      }
      const cat = pg.map(norm).find(l => CATEGORIES[l])
      if (cat) d.resultCategory = CATEGORIES[cat]
      const r1 = pg.find(l => /^[\d.]+ % [\d.]+ %$/.test(l))
      if (r1) { const mm = r1.match(/^([\d.]+) % ([\d.]+) %$/)!; d.riskCurrentPct = Number(mm[1]); d.riskAge70Pct = Number(mm[2]) }
      const r2 = pg.find(l => /^average risk [\d.]+ % [\d.]+ %$/i.test(l))
      if (r2) { const mm = r2.match(/([\d.]+) % ([\d.]+) %/)!; d.riskAvgPct = Number(mm[1]); d.riskAge70AvgPct = Number(mm[2]) }
      if (!out.diseases.some(x => x.disease === d.disease)) out.diseases.push(d)
    }

    // ── Bloedmarkers (alleen de associatie-tabellen) ──
    const association =
      joined.includes('strongest association') ? 'strongest' :
      joined.includes('moderate association')  ? 'moderate'  :
      joined.includes('weakest association')   ? 'weakest'   : null
    if (association && joined.includes('respect to the score')) {
      for (let i = 0; i < pg.length; i++) {
        const code = MARKERS[norm(pg[i])]
        if (!code) continue
        let value: number | null = null, unit: string | null = null
        for (let k = i + 1; k <= i + 2 && k < pg.length; k++) {
          const m = pg[k].match(VALUE_RE)
          if (m) { value = Number(m[1]); unit = fixUnit(m[2]); break }
        }
        let refOptimal: number | null = null
        for (let k = i - 2; k <= i + 3; k++) {
          if (k < 0 || k >= pg.length) continue
          const m = pg[k].match(REF_RE)
          if (m) { refOptimal = Number(m[1]); break }
        }
        if (value !== null && !out.biomarkers.some(b => b.markerCode === code)) {
          out.biomarkers.push({ markerCode: code, value, unit, refOptimal, association })
        }
      }
    }
  }

  // Basale plausibiliteits-waarschuwingen (helpen bij de review-stap).
  if (!out.meta.sampleId)            out.warnings.push('Sample-ID niet gevonden.')
  if (out.scores.metabolicAge === null)     out.warnings.push('Metabolic Age niet gevonden.')
  if (out.scores.resilienceScore === null)  out.warnings.push('Resilience Score niet gevonden.')
  if (out.diseases.length < 5)       out.warnings.push(`Slechts ${out.diseases.length}/5 ziekterisico's gevonden.`)
  if (out.biomarkers.length < 20)    out.warnings.push(`Slechts ${out.biomarkers.length} bloedmarkers gevonden (verwacht ±26).`)

  return out
}
