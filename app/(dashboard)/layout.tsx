import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { UserProvider } from '@/components/providers/UserProvider'
import { InactivityGuard } from '@/components/providers/InactivityGuard'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // 2FA afdwingen — aal2 = wachtwoord + authenticator-code
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal && aal.currentLevel !== 'aal2') {
    if (aal.nextLevel === 'aal2') {
      // Heeft 2FA ingesteld maar nog niet geverifieerd deze sessie
      redirect('/auth/mfa/verify')
    } else {
      // Heeft nog geen 2FA ingesteld — verplicht instellen
      redirect('/auth/mfa/enroll')
    }
  }

  const [
    { count: newOrderCount },
    { data: medewerker },
  ] = await Promise.all([
    // Badge toont nieuw aangemelde deelnemers die nog verwerkt moeten worden
    supabase
      .from('vh_client')
      .select('*', { count: 'exact', head: true })
      .in('enrollment_status', ['aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld', 'intake_akkoord']),
    supabase
      .from('vh_medewerker')
      .select('name, role')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return (
    <UserProvider
      email={user.email ?? null}
      name={medewerker?.name ?? null}
      role={medewerker?.role ?? null}
    >
      <InactivityGuard>
        <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
          <Sidebar newOrderCount={newOrderCount ?? 0} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </InactivityGuard>
    </UserProvider>
  )
}
