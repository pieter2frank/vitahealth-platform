import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'

// GET /api/annotatie/pdf?clientId=…  — tijdelijke signed-URL naar het rapport-PDF.
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const clientId = new URL(req.url).searchParams.get('clientId') ?? ''
  if (!isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })

  const admin = createAdminClient()

  // Meest recente rapport → gekoppeld document → storage-pad.
  const { data: report } = await admin
    .from('vh_report').select('document_id')
    .eq('client_id', clientId).order('sample_date', { ascending: false }).limit(1).maybeSingle()
  if (!report?.document_id) return NextResponse.json({ error: 'Geen rapport-PDF beschikbaar.' }, { status: 404 })

  const { data: doc } = await admin
    .from('vh_client_document').select('storage_path').eq('id', report.document_id).maybeSingle()
  if (!doc?.storage_path) return NextResponse.json({ error: 'Document niet gevonden.' }, { status: 404 })

  const { data: signed, error } = await admin.storage
    .from('client-documents').createSignedUrl(doc.storage_path, 120)
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: 'PDF kon niet worden geopend.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medisch_deskundige',
    subjectClientId: clientId,
    resourceType:    'client_document',
    resourceId:      report.document_id,
    action:          'view',
    outcome:         'success',
    reason:          'Rapport-PDF geopend vanuit annotatiemodule',
  }).catch(() => {})

  return NextResponse.json({ url: signed.signedUrl })
}
