/**
 * POST /api/postnl/label  { kitId }
 *
 * Maakt via de PostNL API een verzendlabel + track & trace aan voor een
 * toegewezen testkit, slaat de trackingcode op, mailt de cliënt en zet de
 * kit op verzonden. Geeft het label (base64 PDF) terug om te printen.
 */
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShipment, splitAddress, type PostNLReceiver } from '@/lib/postnl'
import { kitVerzondenEmail } from '@/lib/email/templates'
import { logAuditEvent } from '@/lib/audit'
import { isUuid } from '@/lib/validation'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const { kitId } = await req.json().catch(() => ({}))
  if (!isUuid(kitId)) return NextResponse.json({ error: 'Ongeldig kitId.' }, { status: 400 })

  const admin = createAdminClient()

  // Kit + gekoppelde cliënt ophalen
  const { data: kit } = await admin
    .from('vh_testkit')
    .select('id, barcode, assigned_client_id, tracking_code, vh_client(first_name, last_name, email, address, city, postal_code)')
    .eq('id', kitId)
    .single()

  if (!kit) return NextResponse.json({ error: 'Testkit niet gevonden.' }, { status: 404 })
  if (kit.tracking_code) {
    return NextResponse.json({ error: 'Er is al een verzendlabel aangemaakt voor deze kit.' }, { status: 409 })
  }

  const client = kit.vh_client as unknown as {
    first_name: string; last_name: string; email: string | null
    address: string | null; city: string | null; postal_code: string | null
  } | null

  if (!client) return NextResponse.json({ error: 'Geen cliënt aan deze kit gekoppeld.' }, { status: 400 })
  if (!client.address || !client.postal_code || !client.city) {
    return NextResponse.json({ error: 'Adresgegevens van de cliënt zijn onvolledig.' }, { status: 400 })
  }

  // Ontvanger samenstellen
  const { street, houseNr, houseNrExt } = splitAddress(client.address)
  const receiver: PostNLReceiver = {
    name:       `${client.first_name} ${client.last_name}`.trim(),
    street,
    houseNr,
    houseNrExt,
    zipcode:    client.postal_code.replace(/\s+/g, '').toUpperCase(),
    city:       client.city,
    country:    'NL',
  }

  // Label aanmaken bij PostNL
  let shipment
  try {
    shipment = await createShipment(receiver)
  } catch (e) {
    console.error('[postnl/label] fout:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PostNL-aanvraag mislukt.' }, { status: 502 })
  }

  const nowIso = new Date().toISOString()

  // Tracking opslaan + kit op verzonden zetten
  const { error: updErr } = await admin
    .from('vh_testkit')
    .update({
      tracking_code:    shipment.barcode,
      tracking_url:     shipment.trackingUrl,
      label_pdf:        shipment.labelPdfBase64,
      label_created_at: nowIso,
      status:           'kit_verstuurd',
      kit_sent_date:    nowIso,
    })
    .eq('id', kitId)

  if (updErr) {
    console.error('[postnl/label] kit update fout:', updErr)
    return NextResponse.json({ error: 'Trackingcode opslaan mislukt.' }, { status: 500 })
  }

  // Cliëntstatus bijwerken
  if (kit.assigned_client_id) {
    await admin.from('vh_client')
      .update({ enrollment_status: 'kit_opgestuurd' })
      .eq('id', kit.assigned_client_id)
  }

  // Cliënt mailen met trackingcode + retourinstructie
  if (client.email) {
    const { subject, html } = kitVerzondenEmail({
      firstName:    client.first_name,
      trackingCode: shipment.barcode,
      trackingUrl:  shipment.trackingUrl,
    })
    await resend.emails.send({
      from:    `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`,
      to:      client.email,
      subject,
      html,
    }).catch(e => console.error('[postnl/label] mail fout:', e))
  }

  // Auditlog
  logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: kit.assigned_client_id,
    resourceType:    'testkit',
    resourceId:      kitId,
    action:          'create',
    outcome:         'success',
    reason:          `PostNL-label + track&trace aangemaakt (${shipment.barcode})`,
    metadata:        { tracking_code: shipment.barcode },
  }).catch(() => {})

  return NextResponse.json({
    ok:           true,
    trackingCode: shipment.barcode,
    trackingUrl:  shipment.trackingUrl,
    labelPdf:     shipment.labelPdfBase64,
  })
}
