import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSecureDeliveryProvider } from '@/lib/secure-delivery'
import { logAuditEvent } from '@/lib/audit'
import { isUuid } from '@/lib/validation'

// POST /api/reports/send  { documentId }
// Verstuurt een opgeslagen rapport (vh_client_document) beveiligd naar de
// cliënt via de actieve bezorg-provider (Zivver). Alleen voor ingelogde
// medewerkers; elke verzending wordt in de auditlog vastgelegd.

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  // Rol-controle: alleen arts/leefstijlarts mag medische rapporten versturen.
  const { data: me } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).maybeSingle()
  if (!me || !['arts', 'leefstijlarts'].includes(me.role)) {
    return NextResponse.json({ error: 'Alleen voor arts/leefstijlarts.' }, { status: 403 })
  }

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
    subject:        'Je Vita Health rapport staat klaar',
    message:        `Beste ${client.first_name}, in dit beveiligde bericht vind je je persoonlijke Vita Health rapport. ` +
                    `Open het na verificatie. Heb je vragen, neem dan contact met ons op.`,
    attachment: {
      filename:    doc.filename ?? 'vita-health-rapport.pdf',
      content,
      contentType: 'application/pdf',
    },
  })

  // Auditlog — wie, wanneer, welke actie, op welke resource, met welk resultaat.
  await logAuditEvent({
    actorUserId:     user.id,
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
