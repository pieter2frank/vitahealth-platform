import { createAdminClient } from '@/lib/supabase/admin'
import { getAiProvider } from './index'
import { retrieveKnowledge, type RetrievedChunk } from './knowledge'
import { buildClientCaseText } from './case-document'
import { buildClientPriorities, type Priority } from './priorities'

// Adviesgeneratie in drie lagen:
//   1. context   — het volledige gepseudonimiseerde casusdocument (leeftijd,
//                  geslacht, BMI, vragenlijst, biomarkers), niet alleen outliers;
//   2. selectie  — de top 3 aandachtspunten komt uit een deterministische
//                  ranking (lib/ai/priorities.ts), niet uit het model;
//   3. formuleren — het model schrijft per aandachtspunt, met kennis die per
//                  punt gericht is opgehaald, in een verplicht sjabloon.

const SYSTEM = [
  'Je bent een preventieve leefstijl-adviseur van Vita Health. Je schrijft een concept-',
  'leefstijladvies voor een cliënt op basis van een biomarkertest en een intakevragenlijst.',
  'Een arts beoordeelt jouw concept vóór verzending.',
  '',
  'Regels:',
  '- Baseer elk advies UITSLUITEND op de meegeleverde kennisfragmenten; verzin niets.',
  '- Verwijs bij elk advies naar het gebruikte fragment met [nr].',
  '- Is er voor een aandachtspunt geen passende kennis meegeleverd, schrijf dan letterlijk:',
  '  "Voor dit punt is nog geen kennis beschikbaar in de kennisbank; de arts vult dit aan."',
  '- Geen diagnoses, geen medicatie-adviezen of doseringen, geen behandeladvies.',
  '- Noem bij elk aandachtspunt de concrete meetwaarde uit de casus waarop het gebaseerd is.',
  '- Schrijf in het Nederlands, spreek de cliënt aan met "u", concreet en motiverend.',
  '- Houd je exact aan het sjabloon in de opdracht: dezelfde kopjes, dezelfde volgorde,',
  '  geen secties toevoegen of weglaten. Gebruik geen markdown-tekens (geen # of **).',
].join('\n')

const TEMPLATE = [
  'IN HET KORT',
  '(2 à 3 zinnen: het algemene beeld; begin met wat goed gaat.)',
  '',
  'BELANGRIJKSTE AANDACHTSPUNTEN',
  '',
  '1. (titel aandachtspunt 1)',
  'Wat we zien: (de concrete meetwaarde(n) uit de casus)',
  'Advies: (2 à 4 concrete acties, met [nr]-verwijzing naar de gebruikte kennis)',
  'Eerste doel: (één klein, meetbaar doel voor de komende 4 weken)',
  '',
  '2. (titel aandachtspunt 2 — zelfde opbouw)',
  '',
  '3. (titel aandachtspunt 3 — zelfde opbouw)',
  '',
  'OVERIGE PUNTEN',
  '(per overig signaal maximaal 2 zinnen; sla dit kopje over als er niets is)',
  '',
  'VERVOLG',
  '(afsluiting met vervolgstap, en de zin dat dit een concept is dat door een arts',
  'wordt beoordeeld en geen medisch advies vervangt)',
].join('\n')

const TOP_COUNT = 3        // aandachtspunten in het advies
const CHUNKS_PER_TOPIC = 4 // kennisfragmenten per aandachtspunt
const FALLBACK_CHUNKS = 8  // brede greep als er geen aandachtspunten zijn

export interface AdviceContext {
  system:      string
  user:        string
  chunkIds:    string[]
  chunksUsed:  number
  summaryText: string
  priorities:  Priority[]
}

// Bouwt de prompt + opgehaalde kennis voor één cliënt. Apart van generateAdvice
// zodat de model-vergelijking (AI-eval) exact dezelfde context en prompt gebruikt
// als productie — anders vergelijk je modellen op ongelijke input.
export async function buildAdviceContext(clientId: string): Promise<AdviceContext> {
  const [caseDoc, { priorities }] = await Promise.all([
    buildClientCaseText(clientId),
    buildClientPriorities(clientId),
  ])
  const top = priorities.slice(0, TOP_COUNT)
  const rest = priorities.slice(TOP_COUNT)

  // Kennis per aandachtspunt gericht ophalen (met domeinfilter waar bekend);
  // zonder aandachtspunten valt de retrieval terug op één brede greep.
  const perTopic = top.length
    ? await Promise.all(top.map(p => retrieveKnowledge(`${p.titel}. ${p.detail}`, CHUNKS_PER_TOPIC, p.domain)))
    : [await retrieveKnowledge(caseDoc.text.slice(0, 1500), FALLBACK_CHUNKS)]

  // Dedupliceren met behoud van groepering; nummering loopt door over de groepen.
  const seen = new Set<string>()
  const numbered: { chunk: RetrievedChunk; n: number; topic: number }[] = []
  perTopic.forEach((chunks, topicIdx) => {
    for (const c of chunks) {
      if (seen.has(c.chunk_id)) continue
      seen.add(c.chunk_id)
      numbered.push({ chunk: c, n: numbered.length + 1, topic: topicIdx })
    }
  })

  const knowledgeBlocks = top.length
    ? top.map((p, i) => {
        const own = numbered.filter(x => x.topic === i)
        const body = own.length
          ? own.map(x => `[${x.n}] (${x.chunk.domain}) ${x.chunk.title}\n${x.chunk.content}`).join('\n\n')
          : '(geen kennis gevonden voor dit punt)'
        return `Kennis voor aandachtspunt ${i + 1} — ${p.titel}:\n${body}`
      }).join('\n\n')
    : numbered.length
      ? numbered.map(x => `[${x.n}] (${x.chunk.domain}) ${x.chunk.title}\n${x.chunk.content}`).join('\n\n')
      : '(geen kennis in de kennisbank gevonden)'

  const prioLines = top.map((p, i) => `${i + 1}. ${p.titel} — ${p.detail}`).join('\n')
  const restLines = rest.length ? rest.map(p => `- ${p.titel} (${p.detail})`).join('\n') : '- (geen)'

  const user = [
    'CASUSDOCUMENT',
    caseDoc.text,
    '',
    'BELANGRIJKSTE AANDACHTSPUNTEN (vooraf bepaald op basis van de meetwaarden; behandel ze in deze volgorde):',
    prioLines || '(geen aandachtspunten gevonden — schrijf een kort algemeen advies)',
    '',
    'OVERIGE SIGNALEN (alleen kort noemen onder OVERIGE PUNTEN):',
    restLines,
    '',
    'BESCHIKBARE KENNIS (gebruik uitsluitend dit; verwijs met [nr]):',
    knowledgeBlocks,
    '',
    'OPDRACHT: schrijf het conceptadvies en vul daarbij exact dit sjabloon in:',
    '',
    TEMPLATE,
  ].join('\n')

  const summaryText = [
    top.length ? 'Top-aandachtspunten: ' + top.map(p => p.titel).join('; ') + '.' : null,
    rest.length ? 'Overig: ' + rest.map(p => p.titel).join('; ') + '.' : null,
  ].filter(Boolean).join('\n') || 'Geen bijzondere signalen gevonden.'

  return {
    system:      SYSTEM,
    user,
    chunkIds:    numbered.map(x => x.chunk.chunk_id),
    chunksUsed:  numbered.length,
    summaryText,
    priorities:  top,
  }
}

export async function generateAdvice(clientId: string, createdBy: string): Promise<{ adviceId: string; chunksUsed: number; text: string }> {
  const provider = getAiProvider()
  const ctx = await buildAdviceContext(clientId)

  const text = await provider.chat({ system: ctx.system, user: ctx.user, maxTokens: 2500, temperature: 0.3 })

  const admin = createAdminClient()
  const { data: rec, error } = await admin
    .from('vh_advice')
    .insert({
      client_id: clientId,
      status:    'draft',
      content:   { text },
      model:     provider.name,
      sources:   ctx.chunkIds,
      signals:   { summary: ctx.summaryText, priorities: ctx.priorities },
      created_by: createdBy,
    })
    .select('id').single()
  if (error) throw new Error(error.message)

  return { adviceId: rec.id as string, chunksUsed: ctx.chunksUsed, text }
}
