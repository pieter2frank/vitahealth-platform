export type TestkitStatus =
  | 'received'
  | 'assigned'
  | 'retour'
  | 'sent_nightingale'
  | 'results_available'

export interface Testkit {
  id: string
  barcode: string
  date: string
  assigned: boolean
  assigned_client_id: string | null
  assigned_company_id: string | null
  assigned_arbo_id: string | null
  assigned_date: string | null
  retour_date: string | null
  badge_id: string | null
  badge_datesent: string | null
  results_date: string | null
  status: TestkitStatus
  created_at: string
  // joined
  vh_client?: Client | null
  vh_company?: Company | null
  vh_arbo?: Arbo | null
}

export interface Client {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  birth_date: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  kvk: string | null
  created_at: string
}

export interface Arbo {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  created_at: string
}

// ─── Vragenlijsten ───────────────────────────────────────────────────────────

export interface QuestionnaireOption {
  value: string
  label: string
  code?: string
  system?: string
}

export interface QuestionnaireQuestion {
  id: string
  linkId?: string
  type: 'radio' | 'number' | 'long_text' | 'rating_10' | 'short_text' | 'checkbox' | 'scale' | 'boolean'
  fhir_type?: string
  label: string
  category?: string
  required?: boolean
  options?: QuestionnaireOption[]
  // radio / rating_10 / scale labels
  leftLabel?: string
  rightLabel?: string
  // checkbox: optioneel maximum aantal aangevinkte keuzes
  maxSelections?: number
  // scale: configureerbare bereik (default 1–5)
  min?: number
  max?: number
  // omgekeerd scoren: hoge waarde = ongunstig (kleuren worden gespiegeld)
  reversed?: boolean
  // semantische rol voor afgeleide metrics (bijv. BMI) of auto-berekende waarden
  role?: 'height_cm' | 'weight_kg' | 'age_years'
}

export interface QuestionnaireDefinition {
  id: string
  title: string
  status?: string
  questions: QuestionnaireQuestion[]
}

// ─── Programma's ─────────────────────────────────────────────────────────────

export interface ProgramDay {
  day_index: number
  type: string
  title: string
  description: string
  content_blocks: ProgramContentBlock[]
}

export interface ProgramContentBlock {
  type: 'header' | 'text' | 'tip_box' | 'youtube' | 'audio' | 'image' | 'question'
  text?: string
  videoId?: string
  caption?: string
  url?: string
  title?: string
  id?: string
  questionType?: string
  options?: string[]
  placeholder?: string
  min?: number
  max?: number
}

export interface ProgramMeta {
  title: string
  description: string
  tags: string[]
  isPremium: boolean
  imageKey?: string
  visibilityCode?: string | null
  version?: number
  last_updated?: string
  duration_days: number
}

export interface ProgramDefinition {
  id: string
  meta: ProgramMeta
  schedule: ProgramDay[]
}

// ─── Batches ──────────────────────────────────────────────────────────────────

export interface Batch {
  id: string
  badge_id: string
  sent_date: string
  notes: string | null
  status: 'sent' | 'results_received'
  results_date: string | null
  created_at: string
}
