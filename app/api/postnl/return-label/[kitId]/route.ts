/**
 * GET /api/postnl/return-label/[kitId]
 *
 * Geeft het eerder aangemaakte PostNL-retourlabel (PDF) van deze kit terug,
 * zodat het opnieuw geprint kan worden.
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Niet geautoriseerd', { status: 401 })

  const admin = createAdminClient()
  const { data: kit } = await admin
    .from('vh_testkit')
    .select('return_label_pdf, return_label_content_type')
    .eq('id', kitId)
    .single()

  if (!kit?.return_label_pdf) return new Response('Geen retourlabel gevonden voor deze kit', { status: 404 })

  const mime = kit.return_label_content_type ?? 'application/pdf'
  const ext = mime === 'image/gif' ? 'gif' : mime === 'image/jpeg' ? 'jpg' : 'pdf'
  const bytes = Uint8Array.from(atob(kit.return_label_pdf), c => c.charCodeAt(0))
  return new Response(bytes, {
    headers: {
      'Content-Type':        mime,
      'Content-Disposition': `inline; filename="retourlabel-${kitId}.${ext}"`,
      'Cache-Control':       'private, no-store',
    },
  })
}
