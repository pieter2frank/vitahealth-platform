import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/validation'
import { getAiProvider } from '@/lib/ai'
import { requireRole } from '@/lib/ai/route-guard'
import { indexKnowledge } from '@/lib/ai/knowledge'

// POST /api/knowledge/index  { knowledgeId }
// (Her)indexeert een kennisdocument (chunk → embed → opslaan).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const provider = getAiProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: `AI-provider (${provider.name}) is niet geconfigureerd.` }, { status: 503 })
  }

  const { knowledgeId } = await req.json().catch(() => ({}))
  if (!isUuid(knowledgeId)) return NextResponse.json({ error: 'Ongeldig knowledgeId.' }, { status: 400 })

  try {
    const result = await indexKnowledge(knowledgeId)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Indexeren mislukt.' }, { status: 500 })
  }
}
