import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSecureDeliveryProvider } from '@/lib/secure-delivery'
import { logAuditEvent } from '@/lib/audit'
import { isUuid } from '@/lib/validation'
import { requireRole } from '@/lib/auth/guard'

// POST /api/reports/send  { documentId }
// Verstuurt een opgeslagen rapport (vh_client_document) beveiligd naar de
// cliënt via de actieve bezorg-provider (Zivver). Alleen voor ingelogde
// medewerkers; elke verzending wordt in de auditlog vastgelegd.

export const runtime = 'nodejs'   // Zivver-provider gebruikt nodemailer (SMTP)
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { documentId } = await req.json().catch(() => ({}))
  if (!isUuid(documentId)) {
    return NextResponse.json({ error: 'Ongeldig documentId.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Rapport-metadata ophalen
  const { data: doc } = await admin
    .from('vh_client_document')
    .select('id, client_id, filename, storage_path')
    .eq('id', documentId)
    .single()
  if (!doc?.client_id) {
    return NextResponse.json({ error: 'Document niet gevonden.' }, { status: 404 })
  }

  // Cliëntgegevens ophalen
  const { data: client } = await admin
    .from('vh_client')
    .select('id, first_name, last_name, email, phone')
    .eq('id', doc.client_id)
    .single()
  if (!client?.email) {
    return NextResponse.json({ error: 'Cliënt heeft geen e-mailadres.' }, { status: 400 })
  }

  const provider = getSecureDeliveryProvider()
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `Beveiligde verzending (${provider.name}) is nog niet geconfigureerd.` },
      { status: 503 },
    )
  }

  // Rapport uit de private bucket downloaden
  const { data: file, error: dlErr } = await admin.storage
    .from('client-documents')
    .download(doc.storage_path)
  if (dlErr || !file) {
    return NextResponse.json({ error: 'Rapport kon niet worden geladen.' }, { status: 500 })
  }
  const content = Buffer.from(await file.arrayBuffer())

  // Beveiligd versturen — let op: geen gezondheidsdata in subject/body.
  const result = await provider.sendReport({
    to:             client.email,
    recipientName:  `${client.first_name} ${client.last_name}`,
    recipientPhone: client.phone,
    subject:        'Je Vita Health Check rapportage staat klaar',
    message:        `Beste ${client.first_name}, in dit beveiligde bericht vind je je persoonlijke Vita Health rapport. ` +
                    `Dit bericht wordt via een beveiligde verbinding van Zivver opgestuurd. Heb je vragen, neem dan contact met ons op.\n\n` +
                    `Het Vita Health team\n` +
                    `helpdesk@vita-health.nl\n` +
                    `https://helpdesk.vita-health.nl/`,
    attachment: {
      filename:    doc.filename ?? 'vita-health-rapport.pdf',
      content,
      contentType: 'application/pdf',
    },
  })

  // Auditlog — wie, wanneer, welke actie, op welke resource, met welk resultaat.
  await logAuditEvent({
    actorUserId:     auth.userId,
    actorRole:       'medewerker_regulier',
    subjectClientId: client.id,
    resourceType:    'client_document',
    resourceId:      doc.id,
    action:          'email_sent',
    outcome:         result.ok ? 'success' : 'failed',
    reason:          `Beveiligd rapport verstuurd via ${provider.name}`,
    denialReason:    result.ok ? undefined : result.error,
  }).catch(() => {})

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Verzending mislukt.' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, messageId: result.messageId })
}
