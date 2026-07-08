import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

// Gedeelde autorisatie voor API-routes én server-pagina's, zodat het patroon
// `vh_medewerker.select('role').eq('user_id', …)` niet overal herhaald wordt.

async function lookupRole(userId: string): Promise<{ role: string; name: string } | null> {
  const admin = createAdminClient()
  const { data: me } = await admin
    .from('vh_medewerker').select('role, name').eq('user_id', userId).maybeSingle()
  return me ? { role: me.role as string, name: (me.name as string) ?? '' } : null
}

// Voor server-componenten die alleen de rol willen lezen (zonder redirect),
// bijv. om een veld conditioneel te tonen. Null als niet ingelogd / geen rol.
export async function getCurrentUser(): Promise<
  { userId: string; role: string; name: string; email: string | null } | null
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const me = await lookupRole(user.id)
  if (!me) return null
  return { userId: user.id, role: me.role, name: me.name || user.email || '', email: user.email ?? null }
}

// API-routes: geeft de gebruiker + rol terug, of een reden waarom toegang
// geweigerd is (die de aanroeper als NextResponse teruggeeft).
export async function requireRole(allowed: string[]): Promise<
  | { ok: true; userId: string; role: string; name: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Niet geautoriseerd.' }

  const me = await lookupRole(user.id)
  if (!me || !allowed.includes(me.role)) {
    return { ok: false, status: 403, error: 'Onvoldoende rechten.' }
  }
  return { ok: true, userId: user.id, role: me.role, name: me.name || user.email || 'Onbekend' }
}

// Server-componenten: dwingt login + rol af via redirect en geeft anders de
// gebruiker + rol terug.
export async function requireRolePage(
  allowed: string[], deniedRedirect = '/dashboard',
): Promise<{ userId: string; role: string; name: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const me = await lookupRole(user.id)
  if (!me || !allowed.includes(me.role)) redirect(deniedRedirect)
  return { userId: user.id, role: me.role, name: me.name || user.email || 'Onbekend' }
}
