import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid, sanitizeString } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { isKnowledgeDomain } from '@/lib/knowledge-domains'

// PATCH  /api/knowledge/:id  — velden bijwerken (title/body/domain/status/…)
// DELETE /api/knowledge/:id  — kennisdocument verwijderen (chunks cascaden mee)

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const b = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (b.title !== undefined) {
    const t = sanitizeString(b.title, 300)
    if (!t) return NextResponse.json({ error: 'Titel mag niet leeg zijn.' }, { status: 400 })
    patch.title = t
  }
  if (b.domain !== undefined) {
    if (!isKnowledgeDomain(b.domain)) return NextResponse.json({ error: 'Ongeldig domein.' }, { status: 400 })
    patch.domain = b.domain
  }
  if (b.status !== undefined) {
    if (!['draft', 'active', 'archived'].includes(b.status)) {
      return NextResponse.json({ error: 'Ongeldige status.' }, { status: 400 })
    }
    patch.status = b.status
  }
  if (b.content_type !== undefined) patch.content_type = b.content_type === 'video' ? 'video' : 'text'
  if (b.body !== undefined)      patch.body      = typeof b.body === 'string' ? b.body : ''
  if (b.media_url !== undefined) patch.media_url = sanitizeString(b.media_url, 1000) || null
  if (b.source !== undefined)    patch.source    = sanitizeString(b.source, 500) || null
  if (b.evidence !== undefined)  patch.evidence  = sanitizeString(b.evidence, 500) || null

  const admin = createAdminClient()
  // Domein op het document → ook denormaliseren op reeds bestaande chunks.
  if (patch.domain !== undefined) {
    await admin.from('vh_knowledge_chunk').update({ domain: patch.domain }).eq('knowledge_id', id)
  }
  const { error } = await admin.from('vh_knowledge').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('vh_knowledge').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
