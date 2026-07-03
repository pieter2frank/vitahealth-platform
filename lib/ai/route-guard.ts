import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Gedeelde autorisatie voor de AI-/kennisbank-routes. Geeft de ingelogde
// gebruiker + rol + naam terug, of een reden waarom toegang geweigerd is.
export async function requireRole(allowed: string[]): Promise<
  | { ok: true; userId: string; role: string; name: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Niet geautoriseerd.' }

  const admin = createAdminClient()
  const { data: me } = await admin
    .from('vh_medewerker').select('role, name').eq('user_id', user.id).maybeSingle()

  if (!me || !allowed.includes(me.role)) {
    return { ok: false, status: 403, error: 'Onvoldoende rechten.' }
  }
  return { ok: true, userId: user.id, role: me.role as string, name: (me.name as string) ?? user.email ?? 'Onbekend' }
}
