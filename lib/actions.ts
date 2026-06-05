// Vita Health — definitie van actietypes voor de actietabel op het dashboard.
// Geen 'use client' — importeerbaar in server- en client-componenten.

export type ActionType =
  | 'intake_review'
  | 'intake_blocked'
  | 'kit_send'
  | 'kit_batch'
  | 'result_process'
  | 'enrollment_incomplete'

export type RequiredRole = 'arts' | 'medewerker'

export interface ActionMeta {
  label:        string        // korte omschrijving van de actie
  requiredRole: RequiredRole  // welke rol moet dit oppakken
  subject:      'client' | 'kit'
}

export const ACTION_META: Record<ActionType, ActionMeta> = {
  intake_review:         { label: 'Intake beoordelen',           requiredRole: 'arts',       subject: 'client' },
  intake_blocked:        { label: 'Intake geblokkeerd — bellen', requiredRole: 'arts',       subject: 'client' },
  kit_send:              { label: 'Kit versturen naar cliënt',   requiredRole: 'medewerker', subject: 'client' },
  kit_batch:             { label: 'Retour-kit naar Nightingale', requiredRole: 'medewerker', subject: 'kit'    },
  result_process:        { label: 'Uitslag verwerken',           requiredRole: 'medewerker', subject: 'client' },
  enrollment_incomplete: { label: 'Aanmelding niet afgerond',    requiredRole: 'medewerker', subject: 'client' },
}

// Labels voor de rol-badge
export const ROLE_BADGE: Record<RequiredRole, { label: string; className: string }> = {
  arts:       { label: 'Arts',       className: 'bg-violet-100 text-violet-700' },
  medewerker: { label: 'Medewerker', className: 'bg-amber-100 text-amber-700'  },
}

/**
 * Bepaalt of een medewerker met gegeven rol een actie met requiredRole mag oppakken.
 * - Arts-acties: alleen arts of leefstijlarts (medische beoordeling).
 * - Medewerker-acties: iedereen (administratief), inclusief artsen en admins.
 */
export function roleFitsAction(memberRole: string | null | undefined, requiredRole: RequiredRole): boolean {
  if (requiredRole === 'arts') {
    return memberRole === 'arts' || memberRole === 'leefstijlarts'
  }
  // medewerker-acties: alle rollen toegestaan
  return true
}
