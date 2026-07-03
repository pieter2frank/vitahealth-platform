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

// Herkent een losstaande kop-regel (markdown # … of **vetgedrukt**). Geeft de
// schone koptekst terug, of null als de alinea geen kop is.
function asHeading(para: string): string | null {
  if (para.includes('\n')) return null // meerdere regels = geen kop
  const atx = /^#{1,6}\s+(.+)$/.exec(para)
  if (atx) return atx[1].trim()
  const bold = /^\*\*(.+?)\*\*$/.exec(para)
  if (bold) return bold[1].trim()
  return null
}

// Splitst een te lange alinea op zinsgrenzen (nooit midden in een zin).
function splitLongParagraph(p: string, target: number): string[] {
  const sentences = p.match(/[^.!?\n]+[.!?]*\s*/g) ?? [p]
  const out: string[] = []
  let buf = ''
  for (const s of sentences) {
    if (buf && (buf.length + s.length) > target) { out.push(buf.trim()); buf = '' }
    buf += s
    while (buf.length > target * 1.5) { out.push(buf.slice(0, target).trim()); buf = buf.slice(target) }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

// Splitst tekst in chunks van ~800 tekens op paragraafgrenzen. Koppen worden
// niet als los fragment opgeslagen maar als context vóór elk fragment van hun
// sectie gezet, zodat een fragment ook los te begrijpen (en te vinden) is.
export function chunkText(body: string, target = 800): string[] {
  const paras = body.replace(/\r\n?/g, '\n').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let heading = ''
  let buf = ''

  const flush = () => { const t = buf.trim(); if (t) chunks.push(t); buf = '' }

  for (const para of paras) {
    const h = asHeading(para)
    if (h !== null) { flush(); heading = h; continue } // kop opent een nieuwe sectie

    const pieces = para.length > target * 1.5 ? splitLongParagraph(para, target) : [para]
    for (const piece of pieces) {
      if (buf && (buf.length + piece.length + 2) > target) flush()
      // Nieuw fragment binnen een sectie krijgt de kop als context-prefix.
      buf = buf ? `${buf}\n\n${piece}` : (heading ? `${heading}\n${piece}` : piece)
    }
  }
  flush()
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
