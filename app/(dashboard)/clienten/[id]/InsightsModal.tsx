'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Stethoscope, X, Loader2, AlertTriangle, Activity, Droplet, HeartPulse, CheckCircle2, Pill } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { QuestionnaireQuestion } from '@/types'

// ─── Kleuren op basis van gunstigheid (1 = ongunstig … 10 = gunstig) ───────────
type Sev = 'red' | 'orange' | 'yellow'
const CHIP: Record<Sev, string> = {
  red:    'bg-red-500 text-white',
  orange: 'bg-orange-400 text-white',
  yellow: 'bg-yellow-300 text-gray-800',
}

// Zet een score om naar een 1–10-schaal; null als niet numeriek.
function toTen(q: QuestionnaireQuestion, v: number): number | null {
  if (Number.isNaN(v)) return null
  if (q.type === 'rating_10') return v
  if (q.type === 'scale') {
    const min = q.min ?? 1, max = q.max ?? 5
    return max === min ? null : ((v - min) / (max - min)) * 9 + 1
  }
  return null
}
// Gunstigheid 1–10 (rekening houdend met reversed). Lager = meer aandacht.
function favorability(q: QuestionnaireQuestion, raw: unknown): number | null {
  const t = toTen(q, Number(raw))
  if (t === null) return null
  return q.reversed ? 11 - t : t
}
function sevFromFav(fav: number): Sev | null {
  if (fav <= 2.5) return 'red'
  if (fav <= 4.5) return 'orange'
  if (fav <= 5.5) return 'yellow'
  return null           // gunstig → geen aandachtspunt
}

function calcBmi(h: unknown, w: unknown): number | null {
  const hh = Number(h), ww = Number(w)
  if (!hh || !ww || hh < 50 || ww < 10) return null
  return Math.round((ww / (hh / 100) ** 2) * 10) / 10
}
function bmiSev(bmi: number): Sev | null {
  if (bmi < 18.5) return 'orange'
  if (bmi < 25)   return null
  if (bmi < 30)   return 'yellow'
  return 'red'
}
function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'ondergewicht'
  if (bmi < 25)   return 'normaal'
  if (bmi < 30)   return 'overgewicht'
  return 'obesitas'
}

function markerStatus(value: number | null, optimal: number | null, direction: string | null): 'good' | 'attention' | 'neutral' {
  if (value == null || optimal == null || !direction) return 'neutral'
  if (direction === 'lower_better')  return value <= optimal ? 'good' : 'attention'
  if (direction === 'higher_better') return value >= optimal ? 'good' : 'attention'
  return 'neutral'
}

const DISEASE: Record<string, string> = {
  heart_attack: 'Hartaanval', ischemic_stroke: 'Herseninfarct', type2_diabetes: 'Diabetes type 2',
  chronic_kidney_disease: 'Chronische nierziekte', fatty_liver_disease: 'Leververvetting',
}
const CAT: Record<string, { label: string; cls: string }> = {
  higher_than_average:   { label: 'Hoger dan gemiddeld', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  notably_above_average: { label: 'Opvallend hoger',     cls: 'bg-red-50 text-red-700 border-red-200' },
}
const nl = (n: number | null | undefined) => (n == null ? '—' : String(n).replace('.', ','))

// ─── Types ────────────────────────────────────────────────────────────────────
interface RefEntry { code: string; display_name: string; direction: string | null; description: string | null; marker_group: string | null }
interface Biomarker { marker_code: string; value: number | null; value_qualifier: string | null; unit: string | null; ref_optimal: number | null }
interface DiseaseRisk { disease: string; result_category: string | null; risk_current_pct: number | null }
interface ReportRow {
  sample_date: string | null; metabolic_age: number | null
  resilience_score: number | null; projection_age: number | null
  vh_report_disease_risk: DiseaseRisk[]; vh_report_biomarker: Biomarker[]
}
interface Loaded {
  responses: Record<string, unknown> | null
  questions: QuestionnaireQuestion[]
  intakeDate: string | null
  report: ReportRow | null
  refs: RefEntry[]
}
interface Props { clientId: string; clientName: string; birthDate: string | null }

function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth); if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

export function InsightsModal({ clientId, clientName, birthDate }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [d, setD] = useState<Loaded | null>(null)

  async function handleOpen() {
    setOpen(true); setLoading(true)
    const supabase = createClient()

    fetch('/api/audit/log', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectClientId: clientId, resourceType: 'questionnaire_response',
        resourceId: clientId, action: 'view', reason: 'Arts-overzicht (intake + biomarkers) ingezien',
      }),
    }).catch(() => {})

    const { data: qr } = await supabase
      .from('vh_questionnaire_response')
      .select('responses, completed_at, questionnaire_id')
      .eq('client_id', clientId)
      .order('completed_at', { ascending: false })
      .limit(1).maybeSingle()

    let questions: QuestionnaireQuestion[] = []
    if (qr?.questionnaire_id) {
      const { data: qDef } = await supabase
        .from('vh_questionnaire').select('json_content').eq('id', qr.questionnaire_id).single()
      const jc = qDef?.json_content as { questions?: QuestionnaireQuestion[] } | null
      questions = jc?.questions ?? []
    }

    const { data: rep } = await supabase
      .from('vh_report')
      .select('sample_date, metabolic_age, resilience_score, projection_age, vh_report_disease_risk(disease, result_category, risk_current_pct), vh_report_biomarker(marker_code, value, value_qualifier, unit, ref_optimal)')
      .eq('client_id', clientId)
      .order('sample_date', { ascending: false })
      .limit(1).maybeSingle()

    const { data: refs } = await supabase
      .from('vh_biomarker_ref').select('code, display_name, direction, description, marker_group')

    setD({
      responses: (qr?.responses as Record<string, unknown>) ?? null,
      questions,
      intakeDate: (qr?.completed_at as string) ?? null,
      report: (rep as ReportRow) ?? null,
      refs: (refs ?? []) as RefEntry[],
    })
    setLoading(false)
  }

  function close() { setOpen(false); setD(null) }

  // ── Afgeleiden ──────────────────────────────────────────────────────────────
  const responses = d?.responses ?? null
  const questions = d?.questions ?? []
  const refByCode = new Map((d?.refs ?? []).map(r => [r.code, r]))

  // Intake-outliers (ongunstige leefstijlscores)
  const intakeOutliers = (responses ? questions : [])
    .filter(q => q.type === 'scale' || q.type === 'rating_10')
    .map(q => {
      const raw = responses![q.id]
      if (raw === null || raw === undefined || raw === '') return null
      const fav = favorability(q, raw)
      if (fav === null) return null
      const sev = sevFromFav(fav)
      if (!sev) return null
      const scaleMax = q.type === 'rating_10' ? 10 : (q.max ?? 5)
      return { id: q.id, label: q.label, category: q.category ?? null, raw: `${Number(raw)}/${scaleMax}`, fav, sev }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.fav - b.fav)

  // Medische context (boolean = ja, checkbox met niet-"geen" selecties)
  const medicalFlags: string[] = []
  if (responses) {
    for (const q of questions) {
      if (q.type === 'boolean' && (responses[q.id] === true || responses[q.id] === 'true')) {
        medicalFlags.push(q.label)
      }
      if (q.type === 'checkbox' && Array.isArray(responses[q.id])) {
        const vals = (responses[q.id] as string[]).filter(v => v !== 'geen')
        if (vals.length) {
          const labels = vals.map(v => q.options?.find(o => o.value === v)?.label ?? v)
          medicalFlags.push(`${q.label.replace(/\?$/, '')}: ${labels.join(', ')}`)
        }
      }
    }
  }

  // BMI
  const heightQ = questions.find(q => q.role === 'height_cm')
  const weightQ = questions.find(q => q.role === 'weight_kg')
  const bmi = responses && heightQ && weightQ ? calcBmi(responses[heightQ.id], responses[weightQ.id]) : null

  // Biomarker-outliers
  const bioOutliers = (d?.report?.vh_report_biomarker ?? [])
    .map(b => ({ ...b, ref: refByCode.get(b.marker_code) }))
    .filter(b => markerStatus(b.value, b.ref_optimal, b.ref?.direction ?? null) === 'attention')

  // Ziekterisico-outliers
  const diseaseOutliers = (d?.report?.vh_report_disease_risk ?? [])
    .filter(dr => dr.result_category && dr.result_category !== 'average_or_lower')

  const age = ageFrom(birthDate)
  const metaAge = d?.report?.metabolic_age ?? null
  const resScore = d?.report?.resilience_score ?? null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
      >
        <Stethoscope size={15} />
        Arts-overzicht
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-8" onClick={close}>
          <div className="my-auto w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#1e293b]">
                  <Stethoscope size={17} className="text-[#1f1683]" />
                  Arts-overzicht — {clientName}
                </h2>
                <p className="mt-0.5 text-xs text-[#64748b]">
                  {loading ? 'Laden…' : (
                    <>
                      {d?.intakeDate ? `Intake ${formatDate(d.intakeDate)}` : 'Geen intake'}
                      {d?.report?.sample_date ? ` · Uitslag ${formatDate(d.report.sample_date)}` : ' · geen uitslag'}
                    </>
                  )}
                </p>
              </div>
              <button onClick={close} className="ml-4 shrink-0 text-[#94a3b8] hover:text-[#64748b]"><X size={18} /></button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-20 text-[#94a3b8]">
                <Loader2 size={20} className="animate-spin" /> <span className="text-sm">Overzicht samenstellen…</span>
              </div>
            ) : (
              <div className="max-h-[74vh] overflow-auto">
                {/* Samenvattingsbalk */}
                <div className="grid grid-cols-2 gap-3 border-b border-[#f1f5f9] px-6 py-4 sm:grid-cols-4">
                  <Summary label="Kalenderleeftijd" value={age != null ? `${age} jr` : '—'} />
                  <Summary
                    label="Metabole leeftijd"
                    value={metaAge != null ? `${metaAge} jr` : '—'}
                    sev={metaAge != null && age != null ? (metaAge > age + 1 ? 'red' : metaAge > age ? 'orange' : null) : undefined}
                  />
                  <Summary
                    label="Resilience-score"
                    value={resScore != null ? `${resScore}/100` : '—'}
                    sev={resScore != null ? (resScore < 40 ? 'red' : resScore < 55 ? 'orange' : null) : undefined}
                  />
                  <Summary
                    label="BMI"
                    value={bmi != null ? `${nl(bmi)} · ${bmiLabel(bmi)}` : '—'}
                    sev={bmi != null ? bmiSev(bmi) : undefined}
                  />
                </div>

                {/* Twee kolommen */}
                <div className="grid gap-px bg-[#f1f5f9] md:grid-cols-2">
                  {/* Intake */}
                  <div className="bg-white p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]">
                      <Activity size={15} className="text-[#94a3b8]" />
                      Intake — aandachtspunten
                      <span className="ml-auto text-xs font-normal text-[#94a3b8]">{intakeOutliers.length}</span>
                    </h3>

                    {medicalFlags.length > 0 && (
                      <div className="mb-3 space-y-1.5">
                        {medicalFlags.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1.5 text-xs text-[#334155]">
                            <Pill size={13} className="mt-0.5 shrink-0 text-[#64748b]" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!responses ? (
                      <p className="py-6 text-center text-sm text-[#94a3b8]">Geen intake-vragenlijst gevonden.</p>
                    ) : intakeOutliers.length === 0 ? (
                      <p className="flex items-center gap-2 py-4 text-sm text-emerald-600"><CheckCircle2 size={15} /> Geen ongunstige leefstijlscores.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {intakeOutliers.map(o => (
                          <li key={o.id} className="flex items-center gap-2.5">
                            <span className={`inline-flex h-6 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${CHIP[o.sev]}`}>{o.raw}</span>
                            <span className="min-w-0 flex-1 text-sm leading-snug text-[#334155]">
                              {o.label}
                              {o.category && <span className="ml-1 text-[10px] text-[#94a3b8]">· {o.category.replace(/^Lifestyle — /, '')}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Biomarkers */}
                  <div className="bg-white p-5">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1e293b]">
                      <Droplet size={15} className="text-[#94a3b8]" />
                      Biomarkers — aandachtspunten
                      <span className="ml-auto text-xs font-normal text-[#94a3b8]">{bioOutliers.length}</span>
                    </h3>

                    {!d?.report ? (
                      <p className="py-6 text-center text-sm text-[#94a3b8]">Nog geen ingelezen uitslag.</p>
                    ) : (
                      <>
                        {diseaseOutliers.length > 0 && (
                          <div className="mb-3 space-y-1.5">
                            {diseaseOutliers.map(dr => {
                              const c = dr.result_category ? CAT[dr.result_category] : null
                              return (
                                <div key={dr.disease} className="flex items-center gap-2 text-sm text-[#334155]">
                                  <HeartPulse size={14} className="shrink-0 text-red-400" />
                                  <span className="flex-1">{DISEASE[dr.disease] ?? dr.disease}
                                    {dr.risk_current_pct != null && <span className="text-[#94a3b8]"> · {nl(dr.risk_current_pct)}%</span>}
                                  </span>
                                  {c && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>{c.label}</span>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {bioOutliers.length === 0 && diseaseOutliers.length === 0 ? (
                          <p className="flex items-center gap-2 py-4 text-sm text-emerald-600"><CheckCircle2 size={15} /> Alle waarden binnen optimaal.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {bioOutliers.map(b => (
                              <li key={b.marker_code} className="flex items-center gap-2.5">
                                <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-orange-400 px-2 text-[11px] font-bold text-white">
                                  {b.value_qualifier ?? ''}{nl(b.value)}{b.unit ? ` ${b.unit}` : ''}
                                </span>
                                <span
                                  className="min-w-0 flex-1 cursor-help border-b border-dotted border-[#cbd5e1] text-sm leading-snug text-[#334155]"
                                  title={b.ref?.description ?? undefined}
                                >
                                  {b.ref?.display_name ?? b.marker_code}
                                </span>
                                {b.ref_optimal != null && <span className="shrink-0 text-[10px] text-[#94a3b8]">opt. {nl(b.ref_optimal)}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-3">
              <div className="flex items-center gap-3 text-[11px] text-[#94a3b8]">
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-red-500" /> ongunstig</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-orange-400" /> aandacht</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-yellow-300" /> licht</span>
                <span className="hidden items-center gap-1.5 sm:flex"><AlertTriangle size={11} /> alleen afwijkingen worden getoond</span>
              </div>
              <button onClick={close} className="text-xs text-[#64748b] hover:text-[#1e293b]">Sluiten</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Summary({ label, value, sev }: { label: string; value: string; sev?: Sev | null }) {
  const tone = sev === 'red' ? 'text-red-600' : sev === 'orange' ? 'text-orange-600' : sev === 'yellow' ? 'text-yellow-700' : 'text-[#1e293b]'
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p className={`text-base font-bold ${tone}`}>{value}</p>
    </div>
  )
}
