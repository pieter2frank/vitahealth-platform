'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RefEntry { code: string; display_name: string; unit: string | null; marker_group: string | null; direction: string | null; sort_order: number }
interface DiseaseRisk { disease: string; result_category: string | null; risk_current_pct: number | null; risk_age70_pct: number | null }
interface Biomarker { marker_code: string; value: number | null; unit: string | null; ref_optimal: number | null; association: string | null }
interface Report {
  id: string; sample_id: string | null; sample_date: string | null
  metabolic_age: number | null; resilience_score: number | null
  resilience_percentile: number | null; resilience_category: string | null
  parse_status: string
  warnings: string[] | null
  vh_report_disease_risk: DiseaseRisk[]
  vh_report_biomarker: Biomarker[]
}
interface Props { reports: Report[]; refs: RefEntry[] }

// ─── Labels ───────────────────────────────────────────────────────────────────
const DISEASE: Record<string, string> = {
  heart_attack: 'Hartaanval', ischemic_stroke: 'Herseninfarct', type2_diabetes: 'Diabetes type 2',
  chronic_kidney_disease: 'Chronische nierziekte', fatty_liver_disease: 'Leververvetting',
}
const CATEGORY: Record<string, { label: string; cls: string }> = {
  average_or_lower:      { label: 'Gemiddeld of lager', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  higher_than_average:   { label: 'Hoger dan gemiddeld', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  notably_above_average: { label: 'Opvallend hoger',     cls: 'bg-red-50 text-red-700 border-red-200' },
}
const GROUP: Record<string, string> = {
  cholesterol: 'Cholesterol', fatty_acids: 'Vetzuren', apolipoproteins: 'Apolipoproteïnen',
  triglycerides: 'Triglyceriden', inflammation: 'Ontsteking', glycated_hemoglobin: 'Geglyceerd hemoglobine',
  fluid_balance: 'Vochtbalans', amino_acids: 'Aminozuren',
}

function markerStatus(value: number | null, optimal: number | null, direction: string | null): 'good' | 'attention' | 'neutral' {
  if (value == null || optimal == null || !direction) return 'neutral'
  if (direction === 'lower_better')  return value <= optimal ? 'good' : 'attention'
  if (direction === 'higher_better') return value >= optimal ? 'good' : 'attention'
  return 'neutral'
}
const DOT: Record<string, string> = { good: 'bg-emerald-500', attention: 'bg-amber-500', neutral: 'bg-[#cbd5e1]' }

export function ReportSection({ reports, refs }: Props) {
  const router = useRouter()
  const { role } = useUser()
  const report = reports[0] ?? null   // prop-gedreven: ververst mee na router.refresh()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  if (!canSeeResults(role) || !report) return null

  const refByCode = new Map(refs.map(r => [r.code, r]))

  async function confirm() {
    if (!report) return
    setConfirming(true); setError('')
    try {
      const res = await fetch('/api/reports/confirm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) { setError(data.error || 'Bevestigen mislukt.'); return }
      router.refresh()
    } catch { setError('Er ging iets mis.') } finally { setConfirming(false) }
  }

  // Markers gegroepeerd + gesorteerd
  const markers = [...report.vh_report_biomarker]
    .map(b => ({ ...b, ref: refByCode.get(b.marker_code) }))
    .sort((a, b) => (a.ref?.sort_order ?? 999) - (b.ref?.sort_order ?? 999))
  const groups: Record<string, typeof markers> = {}
  for (const m of markers) {
    const g = m.ref?.marker_group ?? 'overig'
    ;(groups[g] ??= []).push(m)
  }

  const needsReview = report.parse_status === 'needs_review'

  return (
    <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
          <Activity size={15} className="text-[#94a3b8]" />
          Uitgelezen rapportgegevens
          {report.sample_date && <span className="text-xs font-normal text-[#94a3b8]">· {formatDate(report.sample_date)}</span>}
        </h2>
        {needsReview ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
            <AlertTriangle size={12} /> Te controleren
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 size={12} /> Bevestigd
          </span>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Waarschuwingen (bijv. kit-ID komt niet overeen) */}
        {report.warnings && report.warnings.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle size={13} /> Controlepunten
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700">
              {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Topscores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Metabole leeftijd" value={report.metabolic_age != null ? `${report.metabolic_age} jr` : '—'} />
          <Stat label="Resilience-score" value={report.resilience_score != null ? `${report.resilience_score}/100` : '—'} />
          <Stat label="Percentiel" value={report.resilience_percentile != null ? `${report.resilience_percentile}%` : '—'} />
          <Stat label="Sample-ID" value={report.sample_id ?? '—'} mono />
        </div>

        {/* Ziekterisico's */}
        {report.vh_report_disease_risk.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">Ziekterisico's (10-jaars)</p>
            <div className="rounded-lg border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
              {report.vh_report_disease_risk.map(d => {
                const cat = d.result_category ? CATEGORY[d.result_category] : null
                return (
                  <div key={d.disease} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-[#1e293b]">{DISEASE[d.disease] ?? d.disease}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[#64748b] tabular-nums">{d.risk_current_pct ?? '—'}%<span className="text-[#cbd5e1]"> · 70j {d.risk_age70_pct ?? '—'}%</span></span>
                      {cat && <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cat.cls}`}>{cat.label}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bloedmarkers */}
        {markers.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8] mb-2">Bloedmarkers t.o.v. optimaal</p>
            <div className="space-y-3">
              {Object.entries(groups).map(([g, list]) => (
                <div key={g}>
                  <p className="text-xs font-medium text-[#64748b] mb-1">{GROUP[g] ?? g}</p>
                  <div className="rounded-lg border border-[#e2e8f0] divide-y divide-[#f1f5f9]">
                    {list.map(m => {
                      const st = markerStatus(m.value, m.ref_optimal, m.ref?.direction ?? null)
                      return (
                        <div key={m.marker_code} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                          <span className="flex items-center gap-2 text-[#1e293b]">
                            <span className={`h-1.5 w-1.5 rounded-full ${DOT[st]}`} />
                            {m.ref?.display_name ?? m.marker_code}
                          </span>
                          <span className="text-[#64748b] tabular-nums">
                            <span className="font-medium text-[#1e293b]">{m.value ?? '—'}</span> {m.unit ?? ''}
                            {m.ref_optimal != null && <span className="text-[#94a3b8]"> · opt. {m.ref_optimal}</span>}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* Bevestigen */}
        {needsReview && (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={confirm}
              disabled={confirming}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50"
            >
              {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Waarden bevestigen
            </button>
            <span className="text-xs text-[#94a3b8]">Controleer de waarden t.o.v. het PDF voordat je bevestigt.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p className={`text-lg font-bold text-[#1e293b] ${mono ? 'font-mono text-sm' : ''}`}>{value}</p>
    </div>
  )
}
