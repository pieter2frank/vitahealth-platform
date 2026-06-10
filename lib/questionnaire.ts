// Gedeelde definities en validatie voor de vragenlijst-builder.
// Gebruikt door de builder-UI én de publiceer-API, zodat client en server
// dezelfde regels hanteren.

import type { QuestionnaireQuestion, QuestionnaireDefinition } from '@/types'

export type QuestionType = QuestionnaireQuestion['type']

/** Welke configuratievelden een vraagtype ondersteunt — stuurt de builder-UI aan. */
export interface QuestionTypeMeta {
  type:        QuestionType
  label:       string
  hint:        string
  hasOptions:  boolean   // opties-lijst (radio/checkbox)
  hasRange:    boolean   // min/max (number/scale)
  hasEnds:     boolean   // leftLabel/rightLabel (scale/rating_10)
  hasReversed: boolean   // omgekeerd scoren (schaal-types)
  hasMaxSel:   boolean   // maxSelections (checkbox)
}

export const QUESTION_TYPES: QuestionTypeMeta[] = [
  { type: 'radio',     label: 'Keuzevraag (één antwoord)', hint: 'Eén optie uit een lijst', hasOptions: true,  hasRange: false, hasEnds: false, hasReversed: false, hasMaxSel: false },
  { type: 'checkbox',  label: 'Meerkeuze (meerdere)',      hint: 'Meerdere opties aanvinkbaar', hasOptions: true,  hasRange: false, hasEnds: false, hasReversed: false, hasMaxSel: true },
  { type: 'boolean',   label: 'Ja / nee',                  hint: 'Eenvoudige ja-of-nee-keuze', hasOptions: false, hasRange: false, hasEnds: false, hasReversed: false, hasMaxSel: false },
  { type: 'scale',     label: 'Schaal',                    hint: 'Numerieke schaal, standaard 1–5', hasOptions: false, hasRange: true,  hasEnds: true,  hasReversed: true,  hasMaxSel: false },
  { type: 'rating_10', label: 'Beoordeling 1–10',          hint: '1 tot 10 met labels aan de uiteinden', hasOptions: false, hasRange: false, hasEnds: true,  hasReversed: true,  hasMaxSel: false },
  { type: 'number',    label: 'Getal',                     hint: 'Numerieke invoer (bijv. leeftijd, lengte)', hasOptions: false, hasRange: true,  hasEnds: false, hasReversed: false, hasMaxSel: false },
  { type: 'short_text',label: 'Korte tekst',               hint: 'Eén regel vrije tekst', hasOptions: false, hasRange: false, hasEnds: false, hasReversed: false, hasMaxSel: false },
  { type: 'long_text', label: 'Lange tekst',               hint: 'Meerdere regels vrije tekst', hasOptions: false, hasRange: false, hasEnds: false, hasReversed: false, hasMaxSel: false },
]

export const QUESTION_TYPE_META: Record<string, QuestionTypeMeta> =
  Object.fromEntries(QUESTION_TYPES.map(t => [t.type, t]))

export const ROLE_OPTIONS = [
  { value: '',          label: 'Geen' },
  { value: 'age_years', label: 'Leeftijd (jaren)' },
  { value: 'height_cm', label: 'Lengte (cm)' },
  { value: 'weight_kg', label: 'Gewicht (kg)' },
  { value: 'gender',    label: 'Geslacht' },
]

/** Maakt van een tekst een veilige, stabiele identifier. */
export function slugify(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

/** Genereert een uniek vraag-id binnen een lijst (id's worden nooit hergebruikt). */
export function newQuestionId(existing: { id: string }[]): string {
  const used = new Set(existing.map(q => q.id))
  let n = existing.length + 1
  let id = `q${n}`
  while (used.has(id)) { n++; id = `q${n}` }
  return id
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
}

/** Valideert een vragenlijst-definitie. Server- én client-side gebruikt. */
export function validateDefinition(def: Partial<QuestionnaireDefinition>): ValidationResult {
  const errors: string[] = []

  if (!def.title?.trim()) errors.push('Titel is verplicht.')
  const questions = Array.isArray(def.questions) ? def.questions : []
  if (questions.length === 0) errors.push('Voeg minstens één vraag toe.')

  const ids = new Set<string>()
  questions.forEach((q, i) => {
    const n = `Vraag ${i + 1}`
    if (!q.id?.trim()) errors.push(`${n}: id ontbreekt.`)
    else if (ids.has(q.id)) errors.push(`${n}: id "${q.id}" komt meerdere keren voor.`)
    else ids.add(q.id)

    if (!q.label?.trim()) errors.push(`${n}: vraagtekst ontbreekt.`)
    if (!QUESTION_TYPE_META[q.type]) errors.push(`${n}: onbekend type "${q.type}".`)

    const meta = QUESTION_TYPE_META[q.type]
    if (meta?.hasOptions) {
      const opts = Array.isArray(q.options) ? q.options : []
      if (opts.length < 2) errors.push(`${n}: voeg minstens twee opties toe.`)
      const optVals = new Set<string>()
      opts.forEach((o, j) => {
        if (!o.value?.toString().trim()) errors.push(`${n}, optie ${j + 1}: waarde ontbreekt.`)
        else if (optVals.has(o.value)) errors.push(`${n}: optiewaarde "${o.value}" komt dubbel voor.`)
        else optVals.add(o.value)
        if (!o.label?.trim()) errors.push(`${n}, optie ${j + 1}: label ontbreekt.`)
      })
    }
  })

  return { ok: errors.length === 0, errors }
}
