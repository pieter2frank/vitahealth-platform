import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { processReportDocument, kitIdFromFilename } from '@/lib/reports/process'

// POST /api/reports/upload-by-kit  (multipart/form-data, veld "file")
// Centrale inlaadpagina: bepaalt op basis van het kitnummer in de bestandsnaam
// bij welke cliënt de uitslag hoort, uploadt de PDF naar het dossier en verwerkt
// hem (zelfde flow als de dossier-parse). Alleen arts/leefstijlarts.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let form: FormData
  try { form = await req.formData() }
  catch { return NextResponse.json({ error: 'Geen geldig formulier.' }, { status: 400 }) }

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Geen bestand ontvangen.' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'Alleen PDF-bestanden.', filename: file.name }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Bestand is te groot (max. 20 MB).', filename: file.name }, { status: 400 })
  }

  // Kitnummer uit de bestandsnaam ("NGH Health Check - <kit> - <yymmdd>.pdf").
  const kitId = kitIdFromFilename(file.name)
  if (!kitId) {
    return NextResponse.json({ error: 'Geen kitnummer in de bestandsnaam gevonden.', filename: file.name }, { status: 422 })
  }

  const admin = createAdminClient()

  // Testkit → cliënt opzoeken.
  const { data: kit } = await admin
    .from('vh_testkit').select('id, assigned_client_id').eq('barcode', kitId).maybeSingle()
  if (!kit) {
    return NextResponse.json({ error: `Kitnummer ${kitId} niet gevonden in het systeem.`, filename: file.name, kitId }, { status: 404 })
  }
  if (!kit.assigned_client_id) {
    return NextResponse.json({ error: `Kit ${kitId} is niet aan een cliënt gekoppeld.`, filename: file.name, kitId }, { status: 409 })
  }
  const clientId = kit.assigned_client_id as string

  const { data: client } = await admin
    .from('vh_client').select('first_name, last_name').eq('id', clientId).maybeSingle()
  const clientName = client ? `${client.first_name} ${client.last_name}` : '—'

  // PDF in de private bucket zetten (zelfde padconventie als het dossier).
  const path = `${clientId}/${crypto.randomUUID()}-${file.name}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage
    .from('client-documents').upload(path, buffer, { contentType: 'application/pdf' })
  if (upErr) {
    return NextResponse.json({ error: 'Uploaden naar opslag mislukt.', filename: file.name }, { status: 500 })
  }

  // Documentmetadata opslaan.
  const { data: doc, error: docErr } = await admin
    .from('vh_client_document')
    .insert({ client_id: clientId, filename: file.name, storage_path: path, file_size: file.size, uploaded_by: auth.name })
    .select('id')
    .single()
  if (docErr || !doc) {
    await admin.storage.from('client-documents').remove([path])
    return NextResponse.json({ error: 'Opslaan documentgegevens mislukt.', filename: file.name }, { status: 500 })
  }

  // Verwerken (uitlezen + opslaan + statusupdates), gedeelde flow.
  const result = await processReportDocument(admin, doc.id, auth.userId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error, filename: file.name, kitId, clientId, clientName, documentId: doc.id }, { status: result.status })
  }

  return NextResponse.json({
    ok: true,
    filename:   file.name,
    kitId,
    clientId,
    clientName,
    documentId: doc.id,
    summary:    result.summary,
    warnings:   result.warnings,
  })
}
