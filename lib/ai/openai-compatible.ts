import type { AiProvider, ChatOptions } from './types'

// Zowel Nebius AI Studio als Mistral bieden een OpenAI-compatibele API
// (/embeddings en /chat/completions). Deze factory bedient beide.

interface Config {
  name: string
  baseUrl: string
  apiKey: string
  chatModel: string
  embedModel: string
  // Sommige embed-modellen (bv. Qwen3-Embedding) leveren standaard >1024 dims;
  // met dimensions vragen we een 1024-dim vector op die op onze kolom past.
  embedDimensions?: number
}

// MRL-modellen (Qwen3, OpenAI v3) staan toe dat je de vector inkort tot een
// kleinere dimensie. Mocht de provider de dimensions-parameter negeren en toch
// een langere vector teruggeven, dan korten we die zelf in en normaliseren we
// opnieuw (L2) — de correcte werkwijze voor Matryoshka-embeddings.
function fitDimensions(vec: number[], dims?: number): number[] {
  if (!dims || vec.length <= dims) return vec
  const sliced = vec.slice(0, dims)
  const norm = Math.sqrt(sliced.reduce((s, x) => s + x * x, 0)) || 1
  return sliced.map(x => x / norm)
}

export function makeOpenAiCompatibleProvider(cfg: Config): AiProvider {
  // Trailing slash weghalen; anders ontstaat `…/v1//embeddings` → 404.
  const baseUrl = cfg.baseUrl.replace(/\/+$/, '')
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
      const body: Record<string, unknown> = { model: cfg.embedModel, input: texts }
      if (cfg.embedDimensions) body.dimensions = cfg.embedDimensions

      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        throw new Error(`${cfg.name} embed ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      const data = await res.json() as { data: { embedding: number[] }[] }
      return data.data.map(d => fitDimensions(d.embedding, cfg.embedDimensions))
    },

    async chat({ system, user, examples, maxTokens = 900, temperature = 0.3 }: ChatOptions): Promise<string> {
      const messages: { role: string; content: string }[] = []
      if (system) messages.push({ role: 'system', content: system })
      for (const ex of examples ?? []) messages.push({ role: ex.role, content: ex.content })
      messages.push({ role: 'user', content: user })

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ model: cfg.chatModel, messages, max_tokens: maxTokens, temperature }),
      })
      if (!res.ok) {
        throw new Error(`${cfg.name} chat ${res.status}: ${(await res.text()).slice(0, 300)}`)
      }
      const data = await res.json() as {
        choices?: { message?: { content?: string; reasoning_content?: string }; finish_reason?: string }[]
      }
      const choice = data.choices?.[0]
      const content = choice?.message?.content ?? ''
      if (!content.trim()) {
        // Denk-modellen (Kimi-K3, DeepSeek-R1, Qwen-Thinking) zetten hun redenering
        // in reasoning_content; is het tokenbudget op vóór het echte antwoord, dan
        // blijft content leeg. Duidelijke fout i.p.v. een stil leeg advies.
        const dachtAlleen = Boolean(choice?.message?.reasoning_content)
        throw new Error(
          `${cfg.name} gaf een leeg antwoord` +
          (dachtAlleen ? ' — dit is een denk-model dat zijn hele tokenbudget aan redeneren besteedde' : '') +
          (choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : '') +
          '. Kies een niet-denkende instruct-variant of verhoog maxTokens.',
        )
      }
      return content
    },
  }
}
