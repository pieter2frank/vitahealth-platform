// Gedeelde validatie-helpers voor API routes

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Geeft true als de waarde een geldige UUID v4 is. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Escapet HTML-tekens zodat gebruikersnamen veilig in HTML-strings gezet kunnen worden. */
export function escapeHtml(str: unknown): string {
  if (typeof str !== 'string') return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Trimt en begrenst een string; geeft '' als de input geen string is. */
export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

/**
 * Maakt een zoekterm veilig voor gebruik in een PostgREST .or()/.ilike()-filter.
 * Verwijdert de structurele metatekens , ( ) en de LIKE-wildcards % _ (plus * \ ")
 * zodat een gebruiker niet uit de filtergrammatica kan breken of wildcard-injectie
 * kan doen. Begrenst de lengte.
 */
export function sanitizeSearchTerm(value: unknown, maxLength = 100): string {
  if (typeof value !== 'string') return ''
  return value.replace(/[,()%_*\\"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
}
