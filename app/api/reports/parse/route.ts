import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'
import { processReportDocument } from '@/lib/reports/process'

// POST /api/reports/parse  { documentId }
// Leest een opgeslagen Nightingale-rapport (PDF) uit en slaat de waarden
// gestructureerd op (vh_report*) met parse_status = 'needs_review'.
// Alleen arts/leefstijlarts; elke verwerking wordt in de auditlog vastgelegd.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  const { documentId } = await req.json().catch(() => ({}))
  if (!isUuid(documentId)) return NextResponse.json({ error: 'Ongeldig documentId.' }, { status: 400 })

  const result = await processReportDocument(admin, documentId, auth.userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true, reportId: result.reportId, summary: result.summary, warnings: result.warnings })
}
