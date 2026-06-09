/**
 * GET /api/documenten/[docId]/download
 *
 * Backend-proxy voor het downloaden van een cliëntdocument (medische uitslag).
 * - Authenticatie vereist
 * - Autorisatie: alleen arts/leefstijlarts (canSeeResults)
 * - Auditlog vóór het streamen (blokkerend)
 * - Het bestand wordt door de server gestreamd; er wordt geen signed URL
 *   naar de browser gelekt.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canSeeResults } from '@/lib/auth/roles'
import { logAuditEventOrThrow } from '@/lib/audit'
import { isUuid } from '@/lib/validation'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ docId: string }> },
) {
  const { docId } = await params
  if (!isUuid(docId)) return new Response('Ongeldig document-ID', { status: 400 })

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Niet geautoriseerd', { status: 401 })

  // Autorisatie: alleen wie medische uitslagen mag zien
  const { data: me } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (!canSeeResults(me?.role)) {
    // Geweigerde toegang loggen
    await logAuditEventOrThrow({
      actorUserId:  user.id,
      actorRole:    'medewerker_regulier',
      resourceType: 'client_document',
      resourceId:   docId,
      action:       'access_denied',
      outcome:      'denied',
      denialReason: 'Geen recht op medische uitslagen',
    }).catch(() => {})
    return new Response('Geen toegang', { status: 403 })
  }

  // Document ophalen
  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('vh_client_document')
    .select('id, client_id, filename, storage_path')
    .eq('id', docId)
    .single()

  if (!doc) return new Response('Document niet gevonden', { status: 404 })

  // Bestand ophalen uit private storage
  const { data: blob, error: dlErr } = await admin.storage
    .from('client-documents')
    .download(doc.storage_path)

  if (dlErr || !blob) return new Response('Bestand niet gevonden', { status: 404 })

  // Auditlog (blokkerend): zonder log geen download
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? ''
  await logAuditEventOrThrow({
    actorUserId:     user.id,
    actorRole:       'medisch_deskundige',
    subjectClientId: doc.client_id,
    resourceType:    'client_document',
    resourceId:      doc.id,
    action:          'view',
    outcome:         'success',
    reason:          'Document gedownload/geopend',
    ipAddress:       ip,
    metadata:        { filename: doc.filename },
  })

  const safeName = doc.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return new Response(blob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
