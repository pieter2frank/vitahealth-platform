import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { getAiProvider } from '@/lib/ai'
import { generateAdvice } from '@/lib/ai/advice'

// POST /api/advice/generate  { clientId }
// Genereert een CONCEPT-advies (RAG) voor een cliënt. Alleen arts/leefstijlarts;
// het advies moet daarna door een arts worden beoordeeld en goedgekeurd.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('vh_medewerker').select('role').eq('user_id', user.id).maybeSingle()
  if (!me || !['arts', 'leefstijlarts'].includes(me.role)) {
    return NextResponse.json({ error: 'Alleen voor arts/leefstijlarts.' }, { status: 403 })
  }

  const provider = getAiProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json({ error: `AI-provider (${provider.name}) is niet geconfigureerd.` }, { status: 503 })
  }

  const { clientId } = await req.json().catch(() => ({}))
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  try {
    const result = await generateAdvice(clientId, user.id)
    await logAuditEvent({
      actorUserId:     user.id,
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
