'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, ChevronUp, ChevronDown, GripVertical, AlertTriangle,
  Loader2, Save, Copy, ListChecks,
} from 'lucide-react'
import {
  QUESTION_TYPES, QUESTION_TYPE_META, ROLE_OPTIONS,
  validateDefinition, newQuestionId,
} from '@/lib/questionnaire'
import type { QuestionnaireDefinition, QuestionnaireQuestion } from '@/types'

interface Props {
  mode: 'create' | 'edit'
  questionnaireId?: string
  initial: QuestionnaireDefinition
  /** Aantal antwoorden tegen de huidige versie (waarschuwing dat publiceren een nieuwe versie maakt). */
  responseCount?: number
}

export function QuestionnaireBuilder({ mode, questionnaireId, initial, responseCount = 0 }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(initial.title ?? '')
  const [description, setDescription] = useState(initial.description ?? '')
  const [status, setStatus] = useState(initial.status === 'active' ? 'active' : 'draft')
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>(initial.questions ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(initial.questions?.[0]?.id ?? null)

  function patch(id: string, fields: Partial<QuestionnaireQuestion>) {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...fields } : q))
  }

  function addQuestion() {
    const id = newQuestionId(questions)
    const q: QuestionnaireQuestion = { id, type: 'radio', label: '', required: true, options: [
      { value: 'optie_1', label: '' }, { value: 'optie_2', label: '' },
    ] }
    setQuestions(qs => [...qs, q])
    setOpenId(id)
  }

  function duplicateQuestion(src: QuestionnaireQuestion) {
    const id = newQuestionId(questions)
    const copy: QuestionnaireQuestion = JSON.parse(JSON.stringify({ ...src, id, label: `${src.label} (kopie)` }))
    const idx = questions.findIndex(q => q.id === src.id)
    setQuestions(qs => [...qs.slice(0, idx + 1), copy, ...qs.slice(idx + 1)])
    setOpenId(id)
  }

  function removeQuestion(id: string) {
    setQuestions(qs => qs.filter(q => q.id !== id))
  }

  function move(id: string, dir: -1 | 1) {
    setQuestions(qs => {
      const i = qs.findIndex(q => q.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= qs.length) return qs
      const copy = [...qs]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })
  }

  function changeType(id: string, type: QuestionnaireQuestion['type']) {
    const meta = QUESTION_TYPE_META[type]
    patch(id, {
      type,
      options: meta.hasOptions
        ? (questions.find(q => q.id === id)?.options ?? [{ value: 'optie_1', label: '' }, { value: 'optie_2', label: '' }])
        : undefined,
      min: meta.hasRange ? questions.find(q => q.id === id)?.min : undefined,
      max: meta.hasRange ? questions.find(q => q.id === id)?.max : undefined,
      leftLabel: meta.hasEnds ? questions.find(q => q.id === id)?.leftLabel : undefined,
      rightLabel: meta.hasEnds ? questions.find(q => q.id === id)?.rightLabel : undefined,
      reversed: meta.hasReversed ? questions.find(q => q.id === id)?.reversed : undefined,
      maxSelections: meta.hasMaxSel ? questions.find(q => q.id === id)?.maxSelections : undefined,
    })
  }

  async function handleSave() {
    setError('')
    const def: Partial<QuestionnaireDefinition> = { title, description, status, questions }
    const { ok, errors } = validateDefinition(def)
    if (!ok) { setError(errors[0]); setOpenIdForFirstError(errors); return }

    setSaving(true)
    const url = mode === 'create' ? '/api/admin/vragenlijsten' : `/api/admin/vragenlijsten/${questionnaireId}`
    const method = mode === 'create' ? 'POST' : 'PUT'
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(def),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Opslaan mislukt.'); return }

    const targetId = mode === 'create' ? data.id : questionnaireId
    router.push(`/vragenlijsten/${targetId}`)
    router.refresh()
  }

  // Eenvoudige hulp: open de eerste vraag met een fout (best effort)
  function setOpenIdForFirstError(errs: string[]) {
    const m = errs[0]?.match(/Vraag (\d+)/)
    if (m) { const idx = Number(m[1]) - 1; if (questions[idx]) setOpenId(questions[idx].id) }
  }

  return (
    <div className="space-y-5">
      {/* Algemene gegevens */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm p-5 space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1e293b]">Titel</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Bijv. Onboarding vragenlijst"
            className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1e293b]">Omschrijving <span className="text-[#94a3b8] font-normal">(optioneel)</span></label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Korte toelichting voor de invuller"
            className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1e293b]">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
          >
            <option value="draft">Concept (niet zichtbaar voor cliënten)</option>
            <option value="active">Actief</option>
          </select>
        </div>
      </div>

      {/* Versie-waarschuwing */}
      {mode === 'edit' && responseCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Er zijn al <strong>{responseCount}</strong> antwoord(en) op de huidige versie. Bij publiceren wordt een
            <strong> nieuwe versie</strong> aangemaakt; bestaande antwoorden blijven gekoppeld aan hun oorspronkelijke versie en
            blijven leesbaar.
          </p>
        </div>
      )}

      {/* Vragen */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <ListChecks size={15} className="text-[#94a3b8]" />
          Vragen ({questions.length})
        </div>

        {questions.map((q, i) => {
          const meta = QUESTION_TYPE_META[q.type]
          const open = openId === q.id
          return (
            <div key={q.id} className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
              {/* Kop */}
              <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
                <GripVertical size={14} className="text-[#cbd5e1] shrink-0" />
                <span className="text-xs font-mono text-[#94a3b8] w-6 shrink-0">{i + 1}.</span>
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  className="flex-1 min-w-0 text-left text-sm font-medium text-[#1e293b] truncate hover:text-[#1f1683]"
                >
                  {q.label || <span className="text-[#94a3b8] italic">Naamloze vraag</span>}
                  <span className="ml-2 text-xs font-normal text-[#94a3b8]">{meta?.label}</span>
                </button>
                <div className="flex items-center gap-0.5 shrink-0">
                  <IconBtn title="Omhoog" onClick={() => move(q.id, -1)} disabled={i === 0}><ChevronUp size={15} /></IconBtn>
                  <IconBtn title="Omlaag" onClick={() => move(q.id, 1)} disabled={i === questions.length - 1}><ChevronDown size={15} /></IconBtn>
                  <IconBtn title="Dupliceren" onClick={() => duplicateQuestion(q)}><Copy size={14} /></IconBtn>
                  <IconBtn title="Verwijderen" onClick={() => removeQuestion(q.id)} className="text-red-500 hover:bg-red-50"><Trash2 size={14} /></IconBtn>
                </div>
              </div>

              {/* Editor */}
              {open && (
                <div className="p-4 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Vraagtekst" className="sm:col-span-2">
                      <input
                        value={q.label}
                        onChange={e => patch(q.id, { label: e.target.value })}
                        placeholder="Wat wil je vragen?"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Type">
                      <select value={q.type} onChange={e => changeType(q.id, e.target.value as QuestionnaireQuestion['type'])} className={inputCls}>
                        {QUESTION_TYPES.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                    </Field>
                    <Field label="Categorie (kop)">
                      <input
                        value={q.category ?? ''}
                        onChange={e => patch(q.id, { category: e.target.value || undefined })}
                        placeholder="Bijv. Motivatie en doelen"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  {/* Type-specifieke opties */}
                  {meta?.hasOptions && <OptionsEditor question={q} onChange={opts => patch(q.id, { options: opts })} />}

                  {(meta?.hasRange || meta?.hasEnds || meta?.hasMaxSel || q.type === 'number') && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {meta?.hasRange && (
                        <>
                          <Field label="Minimum"><input type="number" value={q.min ?? ''} onChange={e => patch(q.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} placeholder={q.type === 'scale' ? '1' : ''} /></Field>
                          <Field label="Maximum"><input type="number" value={q.max ?? ''} onChange={e => patch(q.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} placeholder={q.type === 'scale' ? '5' : ''} /></Field>
                        </>
                      )}
                      {meta?.hasEnds && (
                        <>
                          <Field label="Label links (laag)"><input value={q.leftLabel ?? ''} onChange={e => patch(q.id, { leftLabel: e.target.value || undefined })} className={inputCls} placeholder="Bijv. Helemaal niet" /></Field>
                          <Field label="Label rechts (hoog)"><input value={q.rightLabel ?? ''} onChange={e => patch(q.id, { rightLabel: e.target.value || undefined })} className={inputCls} placeholder="Bijv. Heel erg" /></Field>
                        </>
                      )}
                      {meta?.hasMaxSel && (
                        <Field label="Max. aantal keuzes (optioneel)"><input type="number" min={1} value={q.maxSelections ?? ''} onChange={e => patch(q.id, { maxSelections: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputCls} /></Field>
                      )}
                      {q.type === 'number' && (
                        <Field label="Semantische rol (optioneel)">
                          <select value={q.role ?? ''} onChange={e => patch(q.id, { role: (e.target.value || undefined) as QuestionnaireQuestion['role'] })} className={inputCls}>
                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </Field>
                      )}
                    </div>
                  )}

                  {/* Schakelaars */}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <Toggle checked={!!q.required} onChange={v => patch(q.id, { required: v })} label="Verplicht" />
                    {meta?.hasReversed && (
                      <Toggle checked={!!q.reversed} onChange={v => patch(q.id, { reversed: v || undefined })}
                        label="Omgekeerd scoren (lage waarde = gunstig)" />
                    )}
                  </div>

                  <p className="text-[11px] text-[#cbd5e1] font-mono">id: {q.id}</p>
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#e2e8f0] py-3 text-sm font-medium text-[#64748b] hover:border-[#1f1683]/40 hover:text-[#1f1683] transition-colors"
        >
          <Plus size={16} /> Vraag toevoegen
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Opslaan */}
      <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#e2e8f0] bg-white/80 backdrop-blur py-3 -mx-8 px-8">
        <button onClick={() => router.back()} className="rounded-lg border border-[#e2e8f0] px-4 py-2 text-sm text-[#64748b] hover:bg-[#f8fafc]">
          Annuleren
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-5 py-2 text-sm font-medium text-white hover:bg-[#1a1270] disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {mode === 'create' ? 'Vragenlijst aanmaken' : 'Wijzigingen publiceren'}
        </button>
      </div>
    </div>
  )
}

// ─── Opties-editor (radio/checkbox) ────────────────────────────────────────────

function OptionsEditor({ question, onChange }: {
  question: QuestionnaireQuestion
  onChange: (opts: { value: string; label: string }[]) => void
}) {
  const opts = question.options ?? []
  function set(i: number, fields: Partial<{ value: string; label: string }>) {
    onChange(opts.map((o, j) => j === i ? { ...o, ...fields } : o))
  }
  function add() {
    const used = new Set(opts.map(o => o.value))
    let n = opts.length + 1
    while (used.has(`optie_${n}`)) n++
    onChange([...opts, { value: `optie_${n}`, label: '' }])
  }
  function remove(i: number) { onChange(opts.filter((_, j) => j !== i)) }

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
      <p className="text-xs font-semibold text-[#475569]">Antwoordopties</p>
      {opts.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={o.label}
            onChange={e => set(i, { label: e.target.value })}
            placeholder={`Optie ${i + 1}`}
            className="flex-1 rounded-md border border-[#e2e8f0] px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
          />
          <input
            value={o.value}
            onChange={e => set(i, { value: e.target.value })}
            placeholder="waarde"
            title="Opgeslagen waarde — wijzig niet als er al antwoorden zijn"
            className="w-28 rounded-md border border-[#e2e8f0] px-2 py-1.5 text-xs font-mono text-[#64748b] bg-white focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
          />
          <IconBtn title="Optie verwijderen" onClick={() => remove(i)} className="text-red-500 hover:bg-red-50" disabled={opts.length <= 2}>
            <Trash2 size={14} />
          </IconBtn>
        </div>
      ))}
      <button onClick={add} className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1f1683] hover:underline">
        <Plus size={13} /> Optie toevoegen
      </button>
    </div>
  )
}

// ─── Kleine UI-helpers ──────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20'

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="block text-xs font-medium text-[#64748b]">{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-4 w-4 rounded border-[#cbd5e1] text-[#1f1683] focus:ring-[#1f1683]/30" />
      <span className="text-sm text-[#475569]">{label}</span>
    </label>
  )
}

function IconBtn({ children, onClick, title, className = '', disabled }: {
  children: React.ReactNode; onClick: () => void; title: string; className?: string; disabled?: boolean
}) {
  return (
    <button
      type="button" onClick={onClick} title={title} disabled={disabled}
      className={`flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  )
}
