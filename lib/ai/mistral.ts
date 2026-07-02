import { makeOpenAiCompatibleProvider } from './openai-compatible'

// Mistral (La Plateforme) — OpenAI-compatibel, EU. mistral-embed is 1024-dim.
export const mistralProvider = makeOpenAiCompatibleProvider({
  name: 'mistral',
  baseUrl:    process.env.MISTRAL_BASE_URL   ?? 'https://api.mistral.ai/v1',
  apiKey:     process.env.MISTRAL_API_KEY    ?? '',
  chatModel:  process.env.MISTRAL_CHAT_MODEL ?? 'mistral-small-latest',
  embedModel: process.env.MISTRAL_EMBED_MODEL ?? 'mistral-embed',
})
