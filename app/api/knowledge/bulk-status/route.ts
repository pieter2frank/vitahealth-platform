import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// POST /api/knowledge/bulk-status  { ids: string[], status }
// Zet meerdere kennisdocumenten in één keer op dezelfde status.
export const dynamic = 'force-dynamic'

const STATUSES = ['draft', 'active', 'archived']

export async function POST(req: Request) {
  const auth = await requireRole(['admin', 'arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const b = await req.json().catch(() => ({}))
  const ids: string[] = Array.isArray(b.ids)
    ? [...new Set((b.ids as unknown[]).filter(v => typeof v === 'string' && isUuid(v)) as string[])]
    : []
  const status = typeof b.status === 'string' ? b.status : ''

  if (ids.length === 0)          return NextResponse.json({ error: 'Geen documenten geselecteerd.' }, { status: 400 })
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Ongeldige status.' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vh_knowledge')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
    .select('id')

  if (error) {
    console.error('[knowledge] bulk status mislukt:', error)
    return NextResponse.json({ error: 'Bijwerken mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated: data?.length ?? 0 })
}
