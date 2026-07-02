import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { getAiProvider } from '@/lib/ai'
import { indexKnowledge } from '@/lib/ai/knowledge'

// POST /api/knowledge/index  { knowledgeId }
// (Her)indexeert een kennisdocument (chunk → embed → opslaan). Alleen admins.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('vh_medewerker').select('role').eq('user_id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Alleen voor admins.' }, { status: 403 })

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
