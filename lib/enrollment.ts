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
  intake_on_hold:       'On hold',
  vragenlijst_ingevuld: 'Vragenlijst',
  intake_akkoord:       'Intake akkoord',
  intake_afgewezen:     'Intake afgewezen',
  kit_opgestuurd:       'Kit opgestuurd',
  kit_retour:           'Kit retour',
  uitslag_bekend:       'Uitslag bekend',
  uitslag_besproken:    'Uitslag besproken',
  geannuleerd:          'Geannuleerd',
}

// ─── Kleuren (badge) ──────────────────────────────────────────────────────────

export const ENROLLMENT_COLORS: Record<string, string> = {
  aangemeld:            'bg-slate-100 text-slate-700 border-slate-200',
  toestemming_gegeven:  'bg-blue-50 text-blue-700 border-blue-200',
  intake_on_hold:       'bg-orange-100 text-orange-800 border-orange-300',
  vragenlijst_ingevuld: 'bg-violet-50 text-violet-700 border-violet-200',
  intake_akkoord:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  intake_afgewezen:     'bg-red-50 text-red-700 border-red-200',
  kit_opgestuurd:       'bg-cyan-50 text-cyan-700 border-cyan-200',
  kit_retour:           'bg-orange-50 text-orange-700 border-orange-200',
  uitslag_bekend:       'bg-green-100 text-green-800 border-green-300',
  uitslag_besproken:    'bg-green-50 text-green-700 border-green-200',
  geannuleerd:          'bg-slate-100 text-slate-500 border-slate-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function enrollmentStatusIndex(status: string): number {
  return ENROLLMENT_STATUSES.indexOf(status as EnrollmentStatus)
}

// Neutrale kleur voor een "Alle"-filterknop (geen status).
export const NEUTRAL_PILL = 'bg-slate-100 text-slate-700 border-slate-200'

// Classnames voor een filter-pill in de statuskleur van de tabel.
// Actief: volledige kleur + ring; inactief: gedimd tot hover.
export function statusPillClass(colorCls: string, active: boolean): string {
  return `rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-all ${colorCls} ${
    active ? 'ring-2 ring-offset-1 ring-[#1f1683] font-semibold shadow-sm' : 'opacity-55 hover:opacity-100'
  }`
}
