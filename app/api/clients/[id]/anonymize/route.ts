import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { logAuditEventOrThrow } from '@/lib/audit'

// POST /api/clients/[id]/anonymize — dossier anonimiseren (retentiebeleid).
// Alleen admin, en alleen voor afgeronde/beëindigde trajecten.
//
// Wat er gebeurt:
//  1. De kluisrij (vh_client_identity) wordt verwijderd → naam, adres, e-mail,
//     telefoon en geboortedatum zijn definitief weg. Het medische spoor blijft
//     naamloos bestaan (statistiek).
//  2. De kopergegevens op bestellingen van deze cliënt worden gewist, zodat het
//     dossier ook via de betaal-administratie niet herleidbaar is. De formele
//     factuur-PDF's (aparte bewaarplicht, 7 jaar) blijven ongemoeid in de
//     afgeschermde facturenbucket.
// Onomkeerbaar — de UI vraagt om expliciete bevestiging.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TERMINAL_STATUSES = ['uitslag_besproken', 'intake_afgewezen', 'geannuleerd']

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldige cliënt.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('vh_client').select('id, enrollment_status').eq('id', id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })

  const status = (client.enrollment_status as string | null) ?? ''
  if (!TERMINAL_STATUSES.includes(status)) {
    return NextResponse.json({
      error: 'Alleen afgeronde of beëindigde trajecten kunnen worden geanonimiseerd (uitslag besproken, intake afgewezen of geannuleerd).',
    }, { status: 409 })
  }

  // Auditlog is hier blokkerend: anonimiseren zonder spoor mag niet.
  await logAuditEventOrThrow({
    actorUserId:     auth.userId,
    actorRole:       'admin',
    subjectClientId: id,
    resourceType:    'client',
    resourceId:      id,
    action:          'delete',
    reason:          'Dossier geanonimiseerd (retentiebeleid) — kluisrij en order-kopergegevens gewist',
    outcome:         'success',
    metadata:        { enrollment_status: status },
  })

  // 1. Kluisrij weg → identiteit definitief onleesbaar.
  const { error: vaultErr } = await admin.from('vh_client_identity').delete().eq('client_id', id)
  if (vaultErr) {
    console.error('[pii] kluisrij verwijderen mislukt:', vaultErr)
    return NextResponse.json({ error: 'Anonimiseren mislukt.' }, { status: 500 })
  }

  // 2. Kopergegevens op bestellingen wissen (factuur-PDF's blijven — eigen bewaarplicht).
  const { error: orderErr } = await admin.from('vh_order').update({
    buyer_first_name: null, buyer_last_name: null,
    buyer_address: null, buyer_postal_code: null, buyer_city: null,
    email: '',
  }).eq('client_id', id)
  if (orderErr) console.error('[pii] order-kopergegevens wissen mislukt:', orderErr)

  return NextResponse.json({ ok: true })
}
