import { NextResponse } from 'next/server'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { requireRole } from '@/lib/ai/route-guard'
import { buildClientCaseText } from '@/lib/ai/case-document'

// POST /api/knowledge/case-text  { clientId }
// Bouwt een gepseudonimiseerd casusdocument (kenmerken + vragenlijst + biomarkers)
// zodat de arts het kan controleren en het advies kan aanvullen. Slaat niets op.

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { clientId } = await req.json().catch(() => ({}))
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  try {
    const doc = await buildClientCaseText(clientId)
    await logAuditEvent({
      actorUserId:     auth.userId,
      actorRole:       'medisch_deskundige',
      subjectClientId: clientId,
      resourceType:    'client',
      resourceId:      clientId,
      action:          'view',
      outcome:         'success',
      reason:          'Casusdocument opgebouwd (trainingsvoorbereiding)',
    }).catch(() => {})
    return NextResponse.json({ ok: true, ...doc })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Opbouwen mislukt.' }, { status: 500 })
  }
}
