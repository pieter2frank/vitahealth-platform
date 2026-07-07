/** Alleen arts en leefstijlarts mogen uitslagen en vragenlijstresultaten zien. */
export function canSeeResults(role: string | null | undefined): boolean {
  return role === 'arts' || role === 'leefstijlarts'
}

/** Alleen admin mag het auditlog en geavanceerde beveiligingsfuncties inzien. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}

/**
 * Wie mag de kennisbank beheren en advies genereren/goedkeuren?
 * Klinische inhoud → arts en leefstijlarts; admin voor beheer.
 */
export function canManageKnowledge(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'arts' || role === 'leefstijlarts'
}

/**
 * Wie mag de geboortedatum van een cliënt zien/bewerken? De logistieke
 * 'medewerker'-rol niet (dataminimalisatie — zie P2-8). DOB is een sterk
 * identificerend gegeven en niet nodig voor kit-logistiek.
 */
export function canSeeBirthDate(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'arts' || role === 'leefstijlarts'
}
