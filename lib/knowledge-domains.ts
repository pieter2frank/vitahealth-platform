// Kennisdomeinen — gedeeld door de kennisbank-UI en de adviesgeneratie.
// De waarden komen overeen met vh_knowledge.domain (zie migratie 058).

export const KNOWLEDGE_DOMAINS = [
  { value: 'voeding',   label: 'Voeding' },
  { value: 'beweging',  label: 'Beweging' },
  { value: 'slaap',     label: 'Slaap' },
  { value: 'stress',    label: 'Stress' },
  { value: 'sociaal',   label: 'Sociale gezondheid' },
  { value: 'middelen',  label: 'Middelen (roken/alcohol)' },
  { value: 'medicatie', label: 'Medicatie' },
  { value: 'algemeen',  label: 'Algemeen' },
] as const

export type KnowledgeDomain = typeof KNOWLEDGE_DOMAINS[number]['value']

export const DOMAIN_LABELS: Record<string, string> =
  Object.fromEntries(KNOWLEDGE_DOMAINS.map(d => [d.value, d.label]))

export function isKnowledgeDomain(v: unknown): v is KnowledgeDomain {
  return typeof v === 'string' && KNOWLEDGE_DOMAINS.some(d => d.value === v)
}

// Bron-markering voor kennisdocumenten die uit een cliëntcasus zijn gemaakt.
export const CASE_SOURCE = 'Casus (arts)'

// Statuslabels + pill-kleuren voor kennisdocumenten.
export const KNOWLEDGE_STATUS_LABELS: Record<string, string> = {
  draft:    'Concept',
  active:   'Actief',
  archived: 'Gearchiveerd',
}
export const KNOWLEDGE_STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-500 border-gray-200',
  active:   'bg-green-100 text-green-700 border-green-200',
  archived: 'bg-slate-100 text-slate-400 border-slate-200',
}
