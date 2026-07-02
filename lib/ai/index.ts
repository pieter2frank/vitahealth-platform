import type { AiProvider } from './types'
import { nebiusProvider } from './nebius'
import { mistralProvider } from './mistral'

export type { AiProvider } from './types'

// Kiest de actieve AI-provider via env AI_PROVIDER (nebius | mistral).
export function getAiProvider(): AiProvider {
  const choice = (process.env.AI_PROVIDER ?? 'nebius').toLowerCase()
  switch (choice) {
    case 'mistral': return mistralProvider
    case 'nebius':
    default:        return nebiusProvider
  }
}

// Hulpfunctie: JS-getallen → pgvector-literal voor insert/RPC-parameters.
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}
