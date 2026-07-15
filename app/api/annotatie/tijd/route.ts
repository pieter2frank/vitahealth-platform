import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// POST /api/annotatie/tijd  { roundId, clientId, seconds }
// Telt een tijdsblok (open → sluiten/opslaan) op bij de beoordelingstijd van de
// arts voor deze casus. Wordt ook via navigator.sendBeacon aangeroepen bij het
// verlaten van de pagina.
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { roundId, clientId } = body
  let seconds = Number(body.seconds)
  if (!isUuid(roundId) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldige casus.' }, { status: 400 })
  if (!Number.isFinite(seconds) || seconds <= 0) return NextResponse.json({ ok: true })
  // Clamp per blok op 2 uur, zodat een per ongeluk open gelaten tab de totaaltijd
  // niet onrealistisch opblaast.
  seconds = Math.min(Math.round(seconds), 7200)

  const admin = createAdminClient()

  // Rij zeker stellen en het tijdsblok optellen.
  await admin.from('vh_annotation').upsert(
    { round_id: roundId, client_id: clientId, arts_user_id: auth.userId },
    { onConflict: 'round_id,client_id,arts_user_id', ignoreDuplicates: true },
  )
  const { data: ann } = await admin.from('vh_annotation')
    .select('id, time_spent_seconds')
    .eq('round_id', roundId).eq('client_id', clientId).eq('arts_user_id', auth.userId).single()
  if (ann) {
    await admin.from('vh_annotation')
      .update({ time_spent_seconds: (ann.time_spent_seconds ?? 0) + seconds })
      .eq('id', ann.id)
  }

  return NextResponse.json({ ok: true })
}
