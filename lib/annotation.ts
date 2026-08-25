// Vita Health — annotatiemodule: gedeelde constants & helpers.

import { ageFrom } from '@/lib/health-scoring'

// De acht vervolg-domeinen (tags) die een arts kan aanvinken.
export const FOLLOWUP_DOMAINS = [
  { value: 'medicatie',          label: 'Medicatie' },
  { value: 'suppletie',          label: 'Suppletie' },
  { value: 'beweging',           label: 'Beweging' },
  { value: 'stressbeheersing',   label: 'Stressbeheersing' },
  { value: 'slaap',              label: 'Slaap' },
  { value: 'voeding',            label: 'Voeding' },
  { value: 'balans',             label: 'Balans' },
  { value: 'middelen',           label: 'Middelen' },
  { value: 'sociale_gezondheid', label: 'Sociale gezondheid' },
] as const

export const FOLLOWUP_VALUES = FOLLOWUP_DOMAINS.map(d => d.value) as readonly string[]

const GENDER: Record<string, string> = {
  man: 'man', vrouw: 'vrouw', anders: 'anders', zeg_liever_niet: 'geslacht onbekend',
}

// Gepseudonimiseerd caselabel (leeftijd + geslacht), consistent met het
// trainingsdocument — geen naam/adres in de annotatie-UI.
export function caseLabel(birthDate: string | null, gender: string | null): string {
  const age = ageFrom(birthDate)
  const bits = [age != null ? `${age}-jarige` : null, gender ? (GENDER[gender] ?? gender) : null]
    .filter(Boolean)
    .join(' ')
  return bits ? `Casus — ${bits}` : 'Casus'
}

export interface AnnotationFields {
  algemeen_beeld:     string
  bespreken_team:     boolean | null
  team_vraag:         string
  advies:             string
  verbeterpotentieel: number | null
  vervolg_domeinen:   string[]
  wearables_nuttig:   boolean | null
}
