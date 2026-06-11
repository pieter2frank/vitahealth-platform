/**
 * POST /api/postnl/return-label  { kitId }
 *
 * Maakt een PostNL-retourlabel aan, geadresseerd aan het in de instellingen
 * opgegeven retouradres (vh_setting 'retour_adres'). De kit-barcode wordt als
 * referentie op het label geprint, zodat bij terugkomst zichtbaar is om welke
 * kit het gaat. Het label (base64 PDF) wordt opgeslagen en teruggegeven om te
 * printen; de kitstatus verandert NIET.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createShipment, type PostNLReceiver } from '@/lib/postnl'
import { logAuditEvent } from '@/lib/audit'
import { isUuid } from '@/lib/validation'

interface RetourAdres {
  name: string; street: string; houseNr: string; houseNrExt?: string
  zipcode: string; city: string; country: string
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const { kitId } = await req.json().catch(() => ({}))
  if (!isUuid(kitId)) return NextResponse.json({ error: 'Ongeldig kitId.' }, { status: 400 })

  const admin = createAdminClient()

  // Kit ophalen
  const { data: kit } = await admin
    .from('vh_testkit')
    .select('id, barcode, assigned_client_id, return_tracking_code')
    .eq('id', kitId)
    .single()

  if (!kit) return NextResponse.json({ error: 'Testkit niet gevonden.' }, { status: 404 })
  if (kit.return_tracking_code) {
    return NextResponse.json({ error: 'Er is al een retourlabel aangemaakt voor deze kit.' }, { status: 409 })
  }

  // Retouradres uit instellingen
  const { data: setting } = await admin
    .from('vh_setting').select('value').eq('key', 'retour_adres').maybeSingle()

  let adres: RetourAdres | null = null
  if (setting?.value) { try { adres = JSON.parse(setting.value) as RetourAdres } catch { adres = null } }
  if (!adres || !adres.street || !adres.houseNr || !adres.zipcode || !adres.city) {
    return NextResponse.json({
      error: 'Retouradres is niet (volledig) ingesteld. Stel het in via Instellingen → Retouradres.',
    }, { status: 400 })
  }

  const receiver: PostNLReceiver = {
    name:       adres.name || 'Retour',
    street:     adres.street,
    houseNr:    adres.houseNr,
    houseNrExt: adres.houseNrExt || undefined,
    zipcode:    adres.zipcode.replace(/\s+/g, '').toUpperCase(),
    city:       adres.city,
    country:    (adres.country || 'NL').toUpperCase(),
  }

  // Retourlabel aanmaken — kit-barcode als referentie (codering op het label)
  let shipment
  try {
    shipment = await createShipment(receiver, { reference: kit.barcode })
  } catch (e) {
    console.error('[postnl/return-label] fout:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'PostNL-aanvraag mislukt.' }, { status: 502 })
  }

  const nowIso = new Date().toISOString()
  const { error: updErr } = await admin
    .from('vh_testkit')
    .update({
      return_tracking_code:      shipment.barcode,
      return_tracking_url:       shipment.trackingUrl,
      return_label_pdf:          shipment.labelBase64,
      return_label_content_type: shipment.contentType,
      return_label_created_at:   nowIso,
    })
    .eq('id', kitId)

  if (updErr) {
    console.error('[postnl/return-label] kit update fout:', updErr)
    return NextResponse.json({ error: 'Retour-trackingcode opslaan mislukt.' }, { status: 500 })
  }

  logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: kit.assigned_client_id,
    resourceType:    'testkit',
    resourceId:      kitId,
    action:          'create',
    outcome:         'success',
    reason:          `PostNL-retourlabel aangemaakt (${shipment.barcode}) voor kit ${kit.barcode}`,
    metadata:        { return_tracking_code: shipment.barcode, kit_barcode: kit.barcode },
  }).catch(() => {})

  return NextResponse.json({
    ok:           true,
    trackingCode: shipment.barcode,
    trackingUrl:  shipment.trackingUrl,
    labelPdf:     shipment.labelBase64,
    contentType:  shipment.contentType,
  })
}
