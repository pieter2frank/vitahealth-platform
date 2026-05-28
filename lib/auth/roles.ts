/** Alleen arts en leefstijlarts mogen uitslagen en vragenlijstresultaten zien. */
export function canSeeResults(role: string | null | undefined): boolean {
  return role === 'arts' || role === 'leefstijlarts'
}
