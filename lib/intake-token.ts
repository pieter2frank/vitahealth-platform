import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// Haalt het intake-token van een cliënt op of maakt er één aan (idempotent —
// één token per cliënt). Uitsluitend server-side aanroepen met de admin-client
// (service_role); het token is de secret voor veilig hervatten in de portal.
export async function getOrCreateIntakeToken(admin: Admin, clientId: string): Promise<string | null> {
  const { data: existing } = await admin
    .from('vh_intake_token').select('token').eq('client_id', clientId).maybeSingle()
  if (existing?.token) return existing.token as string

  const { data: created } = await admin
    .from('vh_intake_token').insert({ client_id: clientId }).select('token').single()
  return (created?.token as string | undefined) ?? null
}
