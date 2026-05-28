'use client'
import { Fragment, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, X, Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingStyle(v: number): string {
  if (v >= 9) return 'bg-emerald-500 text-white'
  if (v >= 7) return 'bg-green-400 text-white'
  if (v >= 5) return 'bg-yellow-300 text-gray-800'
  if (v >= 3) return 'bg-orange-400 text-white'
  return 'bg-red-500 text-white'
}

function displayVal(q: QuestionnaireQuestion, raw: unknown): string {
  if (raw === null || raw === undefined || raw === '') return '—'
  if (q.type === 'radio' && q.options) {
    return q.options.find(o => o.value === String(raw))?.label ?? String(raw)
  }
  if (q.type === 'long_text' && typeof raw === 'string') {
    return raw.length > 80 ? raw.slice(0, 80) + '…' : raw
  }
  return String(raw)
}

function groupByCategory(qs: QuestionnaireQuestion[]) {
  const groups: { cat: string | null; qs: QuestionnaireQuestion[] }[] = []
  const seen = new Set<string>()
  for (const q of qs) {
    const key = q.category ?? '__none__'
    if (!seen.has(key)) { seen.add(key); groups.push({ cat: q.category ?? null, qs: [] }) }
    groups[groups.length - 1].qs.push(q)
  }
  return groups
}

function catAvg(qs: QuestionnaireQuestion[], responses: Record<string, unknown>): number | null {
  const nums = qs
    .filter(q => q.type === 'rating_10')
    .map(q => responses[q.id])
    .filter(v => v !== null && v !== undefined)
    .map(Number)
  if (nums.length === 0) return null
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Record_ {
  id: string
  completed_at: string
  responses: Record<string, unknown>
}

interface Props {
  questionnaireId: string
  questionnaireTitle: string
  clientId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResultsModal({ questionnaireId, questionnaireTitle, clientId }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<Record_[]>([])
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([])

  async function handleOpen() {
    setOpen(true)
    setLoading(true)
    const supabase = createClient()

    const [{ data: recs }, { data: qDef }] = await Promise.all([
      supabase
        .from('vh_questionnaire_response')
        .select('id, completed_at, responses')
        .eq('client_id', clientId)
        .eq('questionnaire_id', questionnaireId)
        .order('completed_at', { ascending: true }),
      supabase
        .from('vh_questionnaire')
        .select('json_content')
        .eq('id', questionnaireId)
        .single(),
    ])

    const def = qDef?.json_content as QuestionnaireDefinition | null
    setQuestions(def?.questions ?? [])
    setRecords((recs ?? []) as Record_[])
    setLoading(false)
  }

  function close() { setOpen(false); setRecords([]); setQuestions([]) }

  const groups = groupByCategory(questions)
  const hasCategories = groups.some(g => g.cat !== null)
  const isMultiple = records.length > 1

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center gap-1 text-xs text-[#1f1683] hover:underline"
      >
        <BarChart3 size={11} />
        Bekijken
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-3xl bg-white rounded-2xl shadow-xl overflow-hidden my-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e8f0] bg-[#f8fafc]">
              <div>
                <h2 className="text-base font-semibold text-[#1e293b]">{questionnaireTitle}</h2>
                <p className="text-xs text-[#64748b] mt-0.5">
                  {loading ? 'Laden…' :
                   records.length === 0 ? 'Geen resultaten' :
                   records.length === 1
                     ? `Ingevuld op ${formatDate(records[0].completed_at)}`
                     : `${records.length}× ingevuld — overzicht van oud naar nieuw`}
                </p>
              </div>
              <button onClick={close} className="text-[#94a3b8] hover:text-[#64748b] transition-colors ml-4 shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-auto max-h-[72vh]">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-[#94a3b8]">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm">Resultaten ophalen…</span>
                </div>
              ) : records.length === 0 ? (
                <p className="text-sm text-center text-[#94a3b8] py-12">Geen opgeslagen antwoorden gevonden.</p>
              ) : (
                <table className="w-full text-sm border-collapse">
                  {/* Column headers: dates */}
                  <thead>
                    <tr className="border-b-2 border-[#e2e8f0] bg-white">
                      <th className="px-5 py-3 text-left font-medium text-[#64748b] w-[38%]">Vraag</th>
                      {records.map((r, i) => (
                        <th key={r.id} className="px-3 py-3 text-center font-medium text-[#64748b] min-w-[72px]">
                          {isMultiple && (
                            <span className="block text-[10px] text-[#94a3b8] font-normal">#{i + 1}</span>
                          )}
                          <span className="block text-xs">{formatDate(r.completed_at)}</span>
                        </th>
                      ))}
                      {isMultiple && (
                        <th className="px-3 py-3 text-center font-medium text-[#64748b] min-w-[52px]">
                          <span className="block text-xs">Δ</span>
                          <span className="block text-[10px] text-[#94a3b8] font-normal">verloop</span>
                        </th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {groups.map((group, gi) => (
                      <Fragment key={group.cat ?? `g${gi}`}>

                        {/* Categorie-koptekst */}
                        {hasCategories && (
                          <tr className="bg-[#f8fafc]">
                            <td colSpan={records.length + (isMultiple ? 2 : 1)} className="px-5 py-2 border-b border-[#e2e8f0]">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                                  {group.cat ?? 'Overige vragen'}
                                </span>

                                {/* Gemiddelde per invulmoment voor rating_10 categorieën */}
                                {group.qs.every(q => q.type === 'rating_10') && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-[#94a3b8]">gem.:</span>
                                    {records.map((r, i) => {
                                      const avg = catAvg(group.qs, r.responses)
                                      return avg !== null ? (
                                        <span key={r.id} className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded text-[10px] font-bold ${ratingStyle(Math.round(avg))}`}>
                                          {avg}
                                        </span>
                                      ) : null
                                    })}
                                    {/* Delta voor gemiddelde */}
                                    {isMultiple && (() => {
                                      const first = catAvg(group.qs, records[0].responses)
                                      const last  = catAvg(group.qs, records[records.length - 1].responses)
                                      if (first === null || last === null) return null
                                      const d = Math.round((last - first) * 10) / 10
                                      if (d === 0) return null
                                      return (
                                        <span className={`text-[10px] font-semibold ${d > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                          ({d > 0 ? '+' : ''}{d})
                                        </span>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Vragen */}
                        {group.qs.map((q) => {
                          const vals = records.map(r => r.responses[q.id])
                          const isNum = q.type === 'rating_10' || q.type === 'number'
                          const numVals = isNum ? vals.map(v => (v !== null && v !== undefined ? Number(v) : null)) : []
                          const first = isNum && numVals.length ? numVals[0] : null
                          const last  = isNum && numVals.length ? numVals[numVals.length - 1] : null
                          const delta = isMultiple && first !== null && last !== null ? last - first : null

                          return (
                            <tr key={q.id} className="border-b border-[#f1f5f9] hover:bg-[#fafbfc] transition-colors">
                              <td className="px-5 py-2.5 text-[#1e293b] leading-snug">{q.label}</td>

                              {records.map((r) => {
                                const raw = r.responses[q.id]
                                const num = isNum && raw !== null && raw !== undefined ? Number(raw) : null
                                return (
                                  <td key={r.id} className="px-3 py-2.5 text-center">
                                    {q.type === 'rating_10' && num !== null ? (
                                      <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold ${ratingStyle(num)}`}>
                                        {num}
                                      </span>
                                    ) : (
                                      <span className="text-[#64748b] text-xs break-words max-w-[120px] block mx-auto">
                                        {displayVal(q, raw)}
                                      </span>
                                    )}
                                  </td>
                                )
                              })}

                              {/* Delta cel */}
                              {isMultiple && (
                                <td className="px-3 py-2.5 text-center">
                                  {delta !== null ? (
                                    <span className={`text-xs font-semibold ${
                                      delta > 0 ? 'text-green-600'
                                      : delta < 0 ? 'text-red-500'
                                      : 'text-[#94a3b8]'
                                    }`}>
                                      {delta > 0 ? `+${delta}` : delta === 0 ? '=' : delta}
                                    </span>
                                  ) : (
                                    <span className="text-[#e2e8f0] text-xs">—</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            {!loading && records.length > 0 && (
              <div className="px-6 py-3 border-t border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" /> 9–10
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-400" /> 7–8
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-300" /> 5–6
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-orange-400" /> 3–4
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" /> 1–2
                  </span>
                </div>
                <button onClick={close} className="text-xs text-[#64748b] hover:text-[#1e293b] transition-colors">
                  Sluiten
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
