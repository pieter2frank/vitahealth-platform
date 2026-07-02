import { createAdminClient } from '@/lib/supabase/admin'
import { getAiProvider, toVectorLiteral } from './index'

export interface RetrievedChunk {
  chunk_id: string
  knowledge_id: string
  domain: string
  title: string
  content: string
  media_url: string | null
  start_seconds: number | null
  similarity: number
}

// Splitst tekst in chunks van ~800 tekens op paragraafgrenzen.
export function chunkText(body: string, target = 800): string[] {
  const paras = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let buf = ''
  for (const p of paras) {
    if (buf && (buf.length + p.length + 2) > target) { chunks.push(buf); buf = '' }
    buf = buf ? `${buf}\n\n${p}` : p
    while (buf.length > target * 1.5) { chunks.push(buf.slice(0, target)); buf = buf.slice(target) }
  }
  if (buf.trim()) chunks.push(buf.trim())
  return chunks
}

// (Her)indexeert één kennisdocument: chunk → embed → opslaan.
export async function indexKnowledge(knowledgeId: string): Promise<{ chunks: number }> {
  const admin = createAdminClient()
  const provider = getAiProvider()

  const { data: doc } = await admin
    .from('vh_knowledge').select('id, domain, body').eq('id', knowledgeId).single()
  if (!doc) throw new Error('Kennisdocument niet gevonden.')

  const chunks = chunkText(doc.body ?? '')
  await admin.from('vh_knowledge_chunk').delete().eq('knowledge_id', knowledgeId)
  if (chunks.length === 0) return { chunks: 0 }

  const embeddings = await provider.embed(chunks)
  const rows = chunks.map((content, i) => ({
    knowledge_id: doc.id,
    domain:       doc.domain,
    chunk_index:  i,
    content,
    embedding:    toVectorLiteral(embeddings[i]),
  }))

  const { error } = await admin.from('vh_knowledge_chunk').insert(rows)
  if (error) throw new Error(error.message)
  return { chunks: chunks.length }
}

// Haalt de meest relevante kennis-chunks op voor een query.
export async function retrieveKnowledge(
  query: string, matchCount = 8, domain: string | null = null,
): Promise<RetrievedChunk[]> {
  const admin = createAdminClient()
  const provider = getAiProvider()
  const [emb] = await provider.embed([query])
  const { data, error } = await admin.rpc('match_knowledge_chunks', {
    query_embedding: toVectorLiteral(emb),
    match_count: matchCount,
    filter_domain: domain,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as RetrievedChunk[]
}
