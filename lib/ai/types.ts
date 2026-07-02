// Uitwisselbare AI-provider. Twee implementaties (Nebius, Mistral) delen dezelfde
// OpenAI-compatibele API-vorm. Alles server-side; API-keys nooit naar de browser.

export interface ChatOptions {
  system?: string
  user: string
  maxTokens?: number
  temperature?: number
}

export interface AiProvider {
  readonly name: string
  /** True zodra key + model-config aanwezig zijn. */
  isConfigured(): boolean
  /** Embeddings (1024-dim) voor een reeks teksten. */
  embed(texts: string[]): Promise<number[][]>
  /** Genereert tekst op basis van een prompt. */
  chat(opts: ChatOptions): Promise<string>
}
