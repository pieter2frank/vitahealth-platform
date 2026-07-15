'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react'
import type { QuestionnaireQuestion } from '@/types'

interface Props {
  questions: QuestionnaireQuestion[]
  assignmentId: string
  questionnaireId: string
  clientId: string
  statusUrl: string | null
}

type ResponseValue = string | string[] | number | boolean | null
type Responses = Record<string, ResponseValue>

export function PublicQuestionnairePlayer({ questions, assignmentId, questionnaireId, clientId, statusUrl }: Props) {
  const topRef = useRef<HTMLFormElement>(null)
  const [responses, setResponses] = useState<Responses>({})
  const [errors, setErrors] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [done, setDone] = useState(false)

  function set(id: string, value: ResponseValue) {
    setResponses(prev => ({ ...prev, [id]: value }))
    setErrors(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  // Groepeer vragen op categorie
  const groups: { label: string | null; questions: QuestionnaireQuestion[] }[] = []
  const seenCats = new Set<string>()
  for (const q of questions) {
    const cat = q.category ?? null
    const key = cat ?? '__none__'
    if (!seenCats.has(key)) {
      seenCats.add(key)
      groups.push({ label: cat, questions: [] })
    }
    groups[groups.length - 1].questions.push(q)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveError('')

    // Valideer verplichte velden
    const missing = new Set<string>()
    for (const q of questions) {
      if (q.required) {
        const val = responses[q.id]
        const empty = val === undefined || val === null || val === ''
          || (Array.isArray(val) && val.length === 0)
        if (empty) missing.add(q.id)
      }
    }
    if (missing.size > 0) {
      setErrors(missing)
      topRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error: respErr } = await supabase
      .from('vh_questionnaire_response')
      .insert({
        assignment_id: assignmentId,
        questionnaire_id: questionnaireId,
        client_id: clientId,
        responses,
      })

    if (respErr) { setSaveError(respErr.message); setSaving(false); return }

    const { error: aErr } = await supabase
      .from('vh_questionnaire_assignment')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', assignmentId)

    if (aErr) { setSaveError(aErr.message); setSaving(false); return }

    // Aanmeldstatus doorzetten na invullen intake-vragenlijst. Alleen ophogen
    // vanuit 'toestemming_gegeven' (guard) zodat een latere status of on-hold
    // niet wordt overschreven. Best-effort: faalt dit, dan blijft de opdracht
    // wél als ingevuld geregistreerd.
    await supabase
      .from('vh_client')
      .update({ enrollment_status: 'vragenlijst_ingevuld' })
      .eq('id', clientId)
      .eq('enrollment_status', 'toestemming_gegeven')

    setDone(true)
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center shadow-sm space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Bedankt!</h2>
          <p className="text-sm text-green-700 leading-relaxed">
            Je antwoorden zijn opgeslagen. Een medisch deskundige beoordeelt je gegevens.
          </p>
        </div>
        {statusUrl && (
          <a
            href={statusUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-green-300 px-4 py-2.5 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
          >
            <ExternalLink size={15} />
            Mijn status volgen
          </a>
        )}
      </div>
    )
  }

  return (
    <form ref={topRef} onSubmit={handleSubmit} className="space-y-5">
      {errors.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">
            {errors.size} verplichte {errors.size === 1 ? 'vraag is' : 'vragen zijn'} nog niet beantwoord.
          </p>
        </div>
      )}

      {groups.map((group, gi) => (
        <div key={gi} className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          {group.label && (
            <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#1e293b]">{group.label}</h2>
            </div>
          )}
          <div className="divide-y divide-[#f1f5f9]">
            {group.questions.map((q) => {
              const hasError = errors.has(q.id)
              return (
                <div key={q.id} className={`px-5 py-5 ${hasError ? 'bg-red-50' : ''}`}>
                  <p className={`text-sm font-medium mb-3 ${hasError ? 'text-red-700' : 'text-[#1e293b]'}`}>
                    {q.label}
                    {q.required && <span className="text-red-400 ml-0.5">*</span>}
                  </p>

                  {/* RADIO */}
                  {q.type === 'radio' && q.options && (
                    <div className="space-y-2.5">
                      {q.options.map(opt => (
                        <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.value}
                            checked={responses[q.id] === opt.value}
                            onChange={() => set(q.id, opt.value)}
                            className="h-4 w-4 accent-[#1f1683] shrink-0"
                          />
                          <span className="text-sm text-[#1e293b] group-hover:text-[#1f1683] transition-colors">
                            {opt.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* NUMBER */}
                  {q.type === 'number' && (
                    <input
                      type="number"
                      min={q.min}
                      max={q.max}
                      value={(responses[q.id] as number | null) ?? ''}
                      onChange={e => set(q.id, e.target.value === '' ? null : Number(e.target.value))}
                      className={`h-10 w-full max-w-[200px] rounded-xl border px-3 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] ${hasError ? 'border-red-300 bg-red-50' : 'border-[#e2e8f0] bg-white'}`}
                    />
                  )}

                  {/* SHORT TEXT */}
                  {q.type === 'short_text' && (
                    <input
                      type="text"
                      maxLength={256}
                      value={(responses[q.id] as string) ?? ''}
                      onChange={e => set(q.id, e.target.value)}
                      className={`h-10 w-full rounded-xl border px-3 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] ${hasError ? 'border-red-300 bg-red-50' : 'border-[#e2e8f0] bg-white'}`}
                    />
                  )}

                  {/* LONG TEXT */}
                  {q.type === 'long_text' && (
                    <textarea
                      value={(responses[q.id] as string) ?? ''}
                      onChange={e => set(q.id, e.target.value)}
                      rows={4}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y ${hasError ? 'border-red-300 bg-red-50' : 'border-[#e2e8f0] bg-white'}`}
                    />
                  )}

                  {/* RATING 1–10 */}
                  {q.type === 'rating_10' && (
                    <div className="mt-1 inline-flex flex-col">
                      <div className="flex gap-1.5">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => {
                          const selected = responses[q.id] === n
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => set(q.id, n)}
                              className={`h-10 w-10 rounded-xl border text-sm font-medium transition-all ${
                                selected
                                  ? 'bg-[#1f1683] text-white border-[#1f1683] scale-110'
                                  : hasError
                                    ? 'border-red-200 bg-red-50 text-red-600 hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                    : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                              }`}
                            >
                              {n}
                            </button>
                          )
                        })}
                      </div>
                      {(q.leftLabel || q.rightLabel) && (
                        <div className="flex justify-between mt-1.5">
                          <span className="text-xs text-[#94a3b8]">{q.leftLabel ?? ''}</span>
                          <span className="text-xs text-[#94a3b8]">{q.rightLabel ?? ''}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CHECKBOX */}
                  {q.type === 'checkbox' && q.options && (() => {
                    const current = Array.isArray(responses[q.id]) ? responses[q.id] as string[] : []
                    const atMax = q.maxSelections !== undefined && current.length >= q.maxSelections
                    return (
                      <div className="space-y-2.5">
                        {q.options.map(opt => {
                          const checked = current.includes(opt.value)
                          return (
                            <label key={opt.value} className={`flex items-center gap-3 ${!checked && atMax ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer group'}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!checked && atMax}
                                onChange={e => {
                                  if (e.target.checked) {
                                    set(q.id, [...current, opt.value])
                                  } else {
                                    set(q.id, current.filter(v => v !== opt.value))
                                  }
                                }}
                                className="h-4 w-4 accent-[#1f1683] shrink-0"
                              />
                              <span className="text-sm text-[#1e293b] group-hover:text-[#1f1683] transition-colors">
                                {opt.label}
                              </span>
                            </label>
                          )
                        })}
                        {q.maxSelections && (
                          <p className="text-xs text-[#94a3b8]">
                            Max. {q.maxSelections} keuze{q.maxSelections !== 1 ? 's' : ''}
                            {current.length > 0 ? ` (${current.length} geselecteerd)` : ''}
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  {/* SCALE */}
                  {q.type === 'scale' && (() => {
                    const scaleMin = q.min ?? 1
                    const scaleMax = q.max ?? 5
                    const steps = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i)
                    return (
                      <div className="mt-1 inline-flex flex-col">
                        <div className="flex gap-1.5">
                          {steps.map(n => {
                            const selected = responses[q.id] === n
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => set(q.id, n)}
                                className={`h-10 w-10 rounded-xl border text-sm font-medium transition-all ${
                                  selected
                                    ? 'bg-[#1f1683] text-white border-[#1f1683] scale-110'
                                    : hasError
                                      ? 'border-red-200 bg-red-50 text-red-600 hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                      : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                }`}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                        {(q.leftLabel || q.rightLabel) && (
                          <div className="flex justify-between mt-1.5">
                            <span className="text-xs text-[#94a3b8]">{q.leftLabel ?? ''}</span>
                            <span className="text-xs text-[#94a3b8]">{q.rightLabel ?? ''}</span>
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {/* BOOLEAN */}
                  {q.type === 'boolean' && (
                    <div className="flex items-center gap-3 mt-2">
                      {([true, false] as const).map(val => {
                        const selected = responses[q.id] === val
                        return (
                          <button
                            key={String(val)}
                            type="button"
                            onClick={() => set(q.id, val)}
                            className={`px-6 py-2 rounded-xl border text-sm font-medium transition-all ${
                              selected
                                ? 'bg-[#1f1683] text-white border-[#1f1683]'
                                : hasError
                                  ? 'border-red-200 bg-red-50 text-red-600 hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                  : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                            }`}
                          >
                            {val ? 'Ja' : 'Nee'}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {saveError && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{saveError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full h-12 rounded-xl bg-[#1f1683] text-sm font-semibold text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={16} />
        {saving ? 'Opslaan…' : 'Antwoorden versturen'}
      </button>

      <p className="text-xs text-center text-[#94a3b8]">
        Je antwoorden worden veilig opgeslagen.
      </p>
    </form>
  )
}
