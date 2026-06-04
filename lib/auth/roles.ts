/** Alleen arts en leefstijlarts mogen uitslagen en vragenlijstresultaten zien. */
export function canSeeResults(role: string | null | undefined): boolean {
  return role === 'arts' || role === 'leefstijlarts'
}

/** Alleen admin mag het auditlog en geavanceerde beveiligingsfuncties inzien. */
export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin'
}
