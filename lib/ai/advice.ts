import { createAdminClient } from '@/lib/supabase/admin'
import { getAiProvider } from './index'
import { retrieveKnowledge } from './knowledge'
import { buildClientSignals } from '@/lib/signals'

const SYSTEM = [
  'Je bent een preventieve leefstijl-adviseur voor Vita Health.',
  'Geef beknopt, persoonlijk advies per relevant domein (voeding, beweging, slaap, stress, sociale gezondheid, middelen).',
  'Baseer je UITSLUITEND op de meegeleverde kennis; verzin niets en voeg geen feiten toe die er niet in staan.',
  'Geef GEEN medicatie-doseringen, geen diagnoses en geen behandeladvies.',
  'Schrijf in het Nederlands, concreet en motiverend.',
  'Sluit af met de zin dat dit een concept is dat een arts beoordeelt en geen medisch advies vervangt.',
].join(' ')

export interface AdviceContext {
  system:      string
  user:        string
  chunkIds:    string[]
  chunksUsed:  number
  summaryText: string
}

// Bouwt de prompt + opgehaalde kennis voor één cliënt. Apart van generateAdvice
// zodat de model-vergelijking (AI-eval) exact dezelfde context en prompt gebruikt
// als productie — anders vergelijk je modellen op ongelijke input.
export async function buildAdviceContext(clientId: string): Promise<AdviceContext> {
  const signals = await buildClientSignals(clientId)
  const chunks = await retrieveKnowledge(signals.summaryText, 8)

  const context = chunks.length
    ? chunks.map((c, i) => `[${i + 1}] (${c.domain}) ${c.title}\n${c.content}`).join('\n\n')
    : '(geen kennis in de kennisbank gevonden)'

  const user = [
    'Signaal-profiel van de cliënt:',
    signals.summaryText,
    '',
    'Beschikbare kennis (gebruik uitsluitend dit):',
    context,
    '',
    'Schrijf het conceptadvies, gegroepeerd per relevant domein.',
  ].join('\n')

  return {
    system:      SYSTEM,
    user,
    chunkIds:    chunks.map(c => c.chunk_id),
    chunksUsed:  chunks.length,
    summaryText: signals.summaryText,
  }
}

export async function generateAdvice(clientId: string, createdBy: string): Promise<{ adviceId: string; chunksUsed: number; text: string }> {
  const provider = getAiProvider()
  const ctx = await buildAdviceContext(clientId)

  const text = await provider.chat({ system: ctx.system, user: ctx.user, maxTokens: 1200, temperature: 0.3 })

  const admin = createAdminClient()
  const { data: rec, error } = await admin
    .from('vh_advice')
    .insert({
      client_id: clientId,
      status:    'draft',
      content:   { text },
      model:     provider.name,
      sources:   ctx.chunkIds,
      signals:   { summary: ctx.summaryText },
      created_by: createdBy,
    })
    .select('id').single()
  if (error) throw new Error(error.message)

  return { adviceId: rec.id as string, chunksUsed: ctx.chunksUsed, text }
}
