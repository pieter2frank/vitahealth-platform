import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { getAiProvider } from '@/lib/ai'
import { requireRole } from '@/lib/auth/guard'
import { generateAdvice } from '@/lib/ai/advice'

// POST /api/advice/generate  { clientId }
// Genereert een CONCEPT-advies (RAG) voor een cliënt. Alleen arts/leefstijlarts;
// het advies moet daarna door een arts worden beoordeeld en goedgekeurd.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const provider = getAiProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: `AI-provider (${provider.name}) is niet geconfigureerd.` }, { status: 503 })
  }

  const { clientId } = await req.json().catch(() => ({}))
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  try {
    const result = await generateAdvice(clientId, auth.name)
    await logAuditEvent({
      actorUserId:     auth.userId,
      actorRole:       'medisch_deskundige',
      subjectClientId: clientId,
      resourceType:    'client',
      resourceId:      clientId,
      action:          'create',
      outcome:         'success',
      reason:          `Conceptadvies gegenereerd (AI, ${result.chunksUsed} kennisbronnen)`,
    }).catch(() => {})
    return NextResponse.json({ ok: true, adviceId: result.adviceId, chunksUsed: result.chunksUsed })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Genereren mislukt.' }, { status: 500 })
  }
}
