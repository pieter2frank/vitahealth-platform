import { makeOpenAiCompatibleProvider } from './openai-compatible'

// Nebius AI Studio — OpenAI-compatibel, EU-gehost. Verifieer de exacte model-ID's
// in het Nebius-dashboard. Qwen3-Embedding levert standaard 4096 dims; met
// embedDimensions (1024) vragen we een vector die op onze kolom past (migratie 058).
export const nebiusProvider = makeOpenAiCompatibleProvider({
  name: 'nebius',
  baseUrl:    process.env.NEBIUS_BASE_URL   ?? 'https://api.studio.nebius.com/v1',
  apiKey:     process.env.NEBIUS_API_KEY    ?? '',
  chatModel:  process.env.NEBIUS_CHAT_MODEL ?? 'meta-llama/Llama-3.3-70B-Instruct',
  embedModel: process.env.NEBIUS_EMBED_MODEL ?? 'Qwen/Qwen3-Embedding-8B',
  embedDimensions: Number(process.env.NEBIUS_EMBED_DIM ?? 1024),
})
