// Vita Health — enrollment status helpers (geen 'use client' — importeerbaar overal)

export const ENROLLMENT_STATUSES = [
  'aangemeld',
  'toestemming_gegeven',
  'vragenlijst_ingevuld',
  'intake_akkoord',
  'kit_opgestuurd',
  'kit_retour',
  'uitslag_bekend',
  'uitslag_besproken',
] as const

export type EnrollmentStatus = typeof ENROLLMENT_STATUSES[number]

// ─── Labels ───────────────────────────────────────────────────────────────────
// Record<string, string> zodat intake_afgewezen (alternatief eindpunt) ook werkt

export const ENROLLMENT_LABELS: Record<string, string> = {
  aangemeld:            'Aangemeld',
  toestemming_gegeven:  'Toestemming',
  vragenlijst_ingevuld: 'Vragenlijst',
  intake_akkoord:       'Intake akkoord',
  intake_afgewezen:     'Intake afgewezen',
  kit_opgestuurd:       'Kit opgestuurd',
  kit_retour:           'Kit retour',
  uitslag_bekend:       'Uitslag bekend',
  uitslag_besproken:    'Uitslag besproken',
}

// ─── Kleuren (badge) ──────────────────────────────────────────────────────────

export const ENROLLMENT_COLORS: Record<string, string> = {
  aangemeld:            'bg-slate-100 text-slate-700 border-slate-200',
  toestemming_gegeven:  'bg-blue-50 text-blue-700 border-blue-200',
  vragenlijst_ingevuld: 'bg-violet-50 text-violet-700 border-violet-200',
  intake_akkoord:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  intake_afgewezen:     'bg-red-50 text-red-700 border-red-200',
  kit_opgestuurd:       'bg-cyan-50 text-cyan-700 border-cyan-200',
  kit_retour:           'bg-orange-50 text-orange-700 border-orange-200',
  uitslag_bekend:       'bg-amber-50 text-amber-700 border-amber-200',
  uitslag_besproken:    'bg-green-50 text-green-700 border-green-200',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function enrollmentStatusIndex(status: string): number {
  return ENROLLMENT_STATUSES.indexOf(status as EnrollmentStatus)
}
