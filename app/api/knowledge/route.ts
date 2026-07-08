import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeString } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { isKnowledgeDomain } from '@/lib/knowledge-domains'

// POST /api/knowledge  { domain, title, body, content_type?, media_url?, source?, evidence? }
// Maakt een kennisdocument aan (RLS blokkeert schrijven → via service_role).

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const domain = sanitizeString(b.domain, 40)
  const title  = sanitizeString(b.title, 300)
  const body   = typeof b.body === 'string' ? b.body : ''
  const contentType = b.content_type === 'video' ? 'video' : 'text'

  if (!isKnowledgeDomain(domain)) return NextResponse.json({ error: 'Ongeldig domein.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'Titel is verplicht.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vh_knowledge')
    .insert({
      domain,
      title,
      body,
      content_type: contentType,
      media_url: sanitizeString(b.media_url, 1000) || null,
      source:    sanitizeString(b.source, 500) || null,
      evidence:  sanitizeString(b.evidence, 500) || null,
      status:    'draft',
      created_by: auth.role,
    })
    .select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
