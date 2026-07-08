// Gedeelde domein-rekenlogica voor leefstijlscores en biomarkers.
// Pure functies (server- én client-safe) — één bron van waarheid, zodat een
// drempel of formule niet op meerdere plekken uit de pas loopt.
//
// Gebruikt door: lib/signals.ts, lib/ai/case-document.ts,
// clienten/[id]/InsightsModal.tsx en ResultsModal.tsx.

/** Minimale vraagvorm die de scorefuncties nodig hebben. */
export interface ScoreQuestion {
  type: string
  reversed?: boolean
  min?: number
  max?: number
}

/** Zet een score om naar een 1–10-schaal; null als niet numeriek/niet van toepassing. */
export function toTen(q: ScoreQuestion, v: number): number | null {
  if (Number.isNaN(v)) return null
  if (q.type === 'rating_10') return v
  if (q.type === 'scale') {
    const mn = q.min ?? 1, mx = q.max ?? 5
    return mx === mn ? null : ((v - mn) / (mx - mn)) * 9 + 1
  }
  return null
}

/** Gunstigheid 1–10 (rekening houdend met reversed). Lager = meer aandacht. */
export function favorability(q: ScoreQuestion, raw: unknown): number | null {
  const t = toTen(q, Number(raw))
  if (t === null) return null
  return q.reversed ? 11 - t : t
}

/** BMI uit lengte (cm) en gewicht (kg); null bij onrealistische/ontbrekende invoer. */
export function calcBmi(heightCm: unknown, weightKg: unknown): number | null {
  const h = Number(heightCm), w = Number(weightKg)
  if (!h || !w || h < 50 || w < 10) return null
  return Math.round((w / (h / 100) ** 2) * 10) / 10
}

/** BMI-categorie (kleine letters). */
export function bmiLabel(bmi: number): string {
  if (bmi < 18.5) return 'ondergewicht'
  if (bmi < 25) return 'normaal'
  if (bmi < 30) return 'overgewicht'
  return 'obesitas'
}

/** Leeftijd in jaren uit een geboortedatum (ISO/parsebaar); null als onbekend. */
export function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth)
  if (Number.isNaN(b.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  if (now < new Date(now.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

export type MarkerStatus = 'good' | 'attention' | 'neutral'

/** Status van een biomarker t.o.v. zijn optimale waarde en richting. */
export function markerStatus(
  value: number | null, optimal: number | null, direction: string | null,
): MarkerStatus {
  if (value == null || optimal == null || !direction) return 'neutral'
  if (direction === 'lower_better')  return value <= optimal ? 'good' : 'attention'
  if (direction === 'higher_better') return value >= optimal ? 'good' : 'attention'
  return 'neutral'
}

/** True als een biomarker aandacht vraagt (afwijkt van optimaal). */
export function markerAttention(
  value: number | null, optimal: number | null, direction: string | null,
): boolean {
  return markerStatus(value, optimal, direction) === 'attention'
}
