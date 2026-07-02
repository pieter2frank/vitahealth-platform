import type { AiProvider, ChatOptions } from './types'

// Zowel Nebius AI Studio als Mistral bieden een OpenAI-compatibele API
// (/embeddings en /chat/completions). Deze factory bedient beide.

interface Config {
  name: string
  baseUrl: string
  apiKey: string
  chatModel: string
  embedModel: string
}

export function makeOpenAiCompatibleProvider(cfg: Config): AiProvider {
  const headers = () => ({
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  })

  return {
    name: cfg.name,

    isConfigured() {
      return Boolean(cfg.apiKey && cfg.baseUrl && cfg.chatModel && cfg.embedModel)
    },

    async embed(texts: string[]): Promise<number[][]> {
      const res = await fetch(`${cfg.baseUrl}/embeddings`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ model: cfg.embedModel, input: texts }),
      })
      if (!res.ok) {
        throw new Error(`${cfg.name} embed ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      const data = await res.json() as { data: { embedding: number[] }[] }
      return data.data.map(d => d.embedding)
    },

    async chat({ system, user, maxTokens = 900, temperature = 0.3 }: ChatOptions): Promise<string> {
      const messages: { role: string; content: string }[] = []
      if (system) messages.push({ role: 'system', content: system })
      messages.push({ role: 'user', content: user })

      const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ model: cfg.chatModel, messages, max_tokens: maxTokens, temperature }),
      })
      if (!res.ok) {
        throw new Error(`${cfg.name} chat ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      const data = await res.json() as { choices?: { message?: { content?: string } }[] }
      return data.choices?.[0]?.message?.content ?? ''
    },
  }
}
