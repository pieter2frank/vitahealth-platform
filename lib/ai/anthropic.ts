import Anthropic from '@anthropic-ai/sdk'
import type { AiProvider, ChatOptions } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Claude (Anthropic) — ALLEEN voor het genereren van tekst, als vergelijkings-
// kandidaat naast Nebius. Bewust géén embeddings: de kennisbank is geïndexeerd
// met Qwen3 op vector(1024) + HNSW; een ander embeddingmodel zou volledige
// herindexering van álle chunks vereisen. Retrieval blijft dus bij Nebius.
//
// ⚠️ AVG: casusteksten zijn gepseudonimiseerd maar blijven bijzondere
//    persoonsgegevens. Gebruik dit pas als de verwerkersovereenkomst én de
//    EU-dataroute met Anthropic zijn vastgelegd (zie ANTHROPIC_* env hieronder).
//
// Env:
//   ANTHROPIC_API_KEY     — vereist; zonder key is de provider niet geconfigureerd
//   ANTHROPIC_CHAT_MODEL  — default claude-opus-4-8
// ─────────────────────────────────────────────────────────────────────────────

const KEY   = process.env.ANTHROPIC_API_KEY ?? ''
const MODEL = process.env.ANTHROPIC_CHAT_MODEL ?? 'claude-opus-4-8'

export const anthropicProvider: AiProvider = {
  name: `anthropic/${MODEL}`,

  isConfigured() {
    return Boolean(KEY)
  },

  async embed(): Promise<number[][]> {
    throw new Error(
      'Anthropic levert geen embeddings. De kennisbank-index blijft op Nebius (Qwen3, 1024 dim).',
    )
  },

  async chat({ system, user, examples, maxTokens = 1200 }: ChatOptions): Promise<string> {
    const client = new Anthropic({ apiKey: KEY })

    // Let op: temperature/top_p bestaan niet meer op Opus 4.8 (400 bij meesturen);
    // sturen doe je via de prompt. Adaptive thinking staat expliciet aan — bij
    // weglaten denkt het model niet.
    const res = await client.messages.create({
      model:      MODEL,
      max_tokens: maxTokens,
      thinking:   { type: 'adaptive' },
      ...(system ? { system } : {}),
      messages: [
        ...(examples ?? []).map(ex => ({ role: ex.role, content: ex.content })),
        { role: 'user' as const, content: user },
      ],
    })

    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim()
  },
}
