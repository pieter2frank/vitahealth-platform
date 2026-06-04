/**
 * POST /api/portal/intake-screener
 *
 * Slaat de uitkomst van de geschiktheidscheck op.
 * Gebruikt admin client zodat RLS geen blokkade vormt.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
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
  const newStatus = choice === 'hold' ? 'intake_on_hold' : 'toestemming_gegeven'

  const { error } = await admin
    .from('vh_client')
    .update({ enrollment_status: newStatus })
    .eq('id', clientId)
    .in('enrollment_status', ['toestemming_gegeven', 'intake_on_hold']) // veiligheidscheck

  if (error) {
    console.error('[intake-screener] update fout:', error)
    return NextResponse.json({ error: 'Opslaan mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
