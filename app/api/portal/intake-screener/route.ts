/**
 * POST /api/portal/intake-screener
 *
 * Legt de geschiktheidsverklaring (stap 4) vast als blijvend record en werkt
 * de aanmeldstatus bij. Gebruikt admin client zodat RLS geen blokkade vormt.
 * De getoonde criteria-tekst wordt server-side toegevoegd (niet vanuit de
 * client) zodat het opgeslagen record niet manipuleerbaar is.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import {
  SCREENER_CRITERIA, SCREENER_VERSION, type ScreenerDeclaration,
} from '@/lib/screener'
import { z } from 'zod'

const schema = z.object({
  clientId: z.string().uuid(),
  choice:   z.enum(['ok', 'hold']),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }

  const { clientId, choice } = parsed.data
  if (!isUuid(clientId)) {
    return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const declaration: ScreenerDeclaration =
    choice === 'hold' ? 'mogelijk_van_toepassing' : 'niet_van_toepassing'

  // 1. Verklaring vastleggen (criteria-tekst + versie server-side toegevoegd)
  const { error: recErr } = await admin
    .from('vh_screener_response')
    .insert({
      client_id:        clientId,
      declaration,
      criteria_version: SCREENER_VERSION,
      criteria_text:    SCREENER_CRITERIA,
    })

  if (recErr) {
    console.error('[intake-screener] verklaring opslaan mislukt:', recErr)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  // 2. Status bijwerken (alleen 'hold' zet on hold; 'ok' laat status ongemoeid
  //    behalve dat we hem op toestemming_gegeven houden)
  const newStatus = choice === 'hold' ? 'intake_on_hold' : 'toestemming_gegeven'
  const { error: updErr } = await admin
    .from('vh_client')
    .update({ enrollment_status: newStatus })
    .eq('id', clientId)
    .in('enrollment_status', ['toestemming_gegeven', 'intake_on_hold'])

  if (updErr) {
    console.error('[intake-screener] status bijwerken mislukt:', updErr)
    return NextResponse.json({ error: 'Status bijwerken mislukt.' }, { status: 500 })
  }

  // 3. Auditlog (portaalgebruiker, eigen data)
  logAuditEvent({
    actorUserId:     null,
    actorRole:       'portaal_eigen_data',
    subjectClientId: clientId,
    resourceType:    'consent',
    resourceId:      clientId,
    action:          'create',
    outcome:         'success',
    reason:          `Geschiktheidsverklaring: ${declaration}`,
    metadata:        { declaration, criteria_version: SCREENER_VERSION },
  }).catch(() => {})

  return NextResponse.json({ ok: true, status: newStatus })
}
