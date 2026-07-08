import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid, sanitizeString } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { getAiProvider } from '@/lib/ai'
import { requireRole } from '@/lib/auth/guard'
import { indexKnowledge } from '@/lib/ai/knowledge'
import { isKnowledgeDomain, CASE_SOURCE } from '@/lib/knowledge-domains'

// POST /api/knowledge/from-case  { clientId, title, domain, body, activate }
// Maakt een kennisdocument uit een (door de arts gecontroleerd) casusdocument,
// indexeert het en zet het desgewenst op 'actief'. Alleen arts/leefstijlarts.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const clientId = b.clientId
  const title  = sanitizeString(b.title, 300)
  const domain = sanitizeString(b.domain, 40)
  const body   = typeof b.body === 'string' ? b.body : ''
  const activate = b.activate !== false // standaard actief maken

  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })
  if (!isKnowledgeDomain(domain)) return NextResponse.json({ error: 'Ongeldig domein.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Titel is verplicht.' }, { status: 400 })
  if (body.trim().length < 20) return NextResponse.json({ error: 'Het document lijkt leeg.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: rec, error } = await admin
    .from('vh_knowledge')
    .insert({
      domain, title, body,
      content_type: 'text',
      source:  CASE_SOURCE,
      status:  activate ? 'active' : 'draft',
      created_by: auth.name,
    })
    .select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Indexeren (chunk + embed). Lukt alleen met geconfigureerde provider.
  let chunks = 0
  let indexed = false
  let indexError: string | null = null
  const provider = getAiProvider()
  if (provider.isConfigured()) {
    try { const r = await indexKnowledge(rec.id); chunks = r.chunks; indexed = true }
    catch (e) { indexError = e instanceof Error ? e.message : 'Indexeren mislukt.' }
  } else {
    indexError = `AI-provider (${provider.name}) is niet geconfigureerd — document opgeslagen maar niet geïndexeerd.`
  }

  await logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: clientId,
    resourceType:    'client',
    resourceId:      clientId,
    action:          'create',
    outcome:         'success',
    reason:          `Trainingsdocument uit casus aangemaakt (kennis ${rec.id})`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, id: rec.id, chunks, indexed, indexError })
}
