/**
 * GET /api/clienten/[id]/intake-link
 *
 * Geeft de intake-aanmeldlink van een cliënt terug (dezelfde link die in de
 * uitnodigingsmail staat), formaat: {PORTAL_URL}/portal/aanmelden?token=...
 * Haalt de bestaande intake-token op of maakt er één aan. Alleen medewerkers.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { getOrCreateIntakeToken } from '@/lib/intake-token'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig ID.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: client } = await admin.from('vh_client').select('id').eq('id', id).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Cliënt niet gevonden.' }, { status: 404 })

  // Token ophalen of aanmaken (idempotent — één token per cliënt)
  const token = await getOrCreateIntakeToken(admin, id)
  if (!token) return NextResponse.json({ error: 'Intake-token aanmaken mislukt.' }, { status: 500 })

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
  return NextResponse.json({ url: `${portalUrl}/portal/aanmelden?token=${token}` })
}
