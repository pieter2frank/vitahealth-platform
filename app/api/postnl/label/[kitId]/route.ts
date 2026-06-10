/**
 * GET /api/postnl/label/[kitId]
 *
 * Geeft het eerder aangemaakte PostNL-label (PDF) van deze kit terug, zodat het
 * opnieuw geprint kan worden zonder een nieuw label/track&trace aan te maken.
 */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kitId: string }> },
) {
  const { kitId } = await params
  if (!isUuid(kitId)) return new Response('Ongeldig kitId', { status: 400 })

  // Auth: alleen ingelogde medewerkers
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Niet geautoriseerd', { status: 401 })

  const admin = createAdminClient()
  const { data: kit } = await admin
    .from('vh_testkit')
    .select('label_pdf')
    .eq('id', kitId)
    .single()

  if (!kit?.label_pdf) return new Response('Geen label gevonden voor deze kit', { status: 404 })

  const bytes = Uint8Array.from(atob(kit.label_pdf), c => c.charCodeAt(0))
  return new Response(bytes, {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `inline; filename="verzendlabel-${kitId}.pdf"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
