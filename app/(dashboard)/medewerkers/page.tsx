import { createAdminClient } from '@/lib/supabase/admin'
import { Users } from 'lucide-react'
import { requireRolePage } from '@/lib/auth/guard'
import { UitnodigingForm } from './UitnodigingForm'
import { MedewerkersTable, type MedewerkerRow } from './MedewerkersTable'

export const metadata = { title: 'Medewerkers — Vita Health' }

export default async function MedewerkersPage() {
  const { userId } = await requireRolePage(['admin'])

  const admin = createAdminClient()

  const { data: medewerkers } = await admin
    .from('vh_medewerker')
    .select('id, name, role, created_at, user_id')
    .order('created_at', { ascending: false })

  // E-mail + on-hold-status uit auth ophalen
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const authMap = new Map(
    (authList?.users ?? []).map(u => [u.id, {
      email:  u.email ?? '',
      onHold: !!u.banned_until && new Date(u.banned_until) > new Date(),
    }]),
  )

  const rows: MedewerkerRow[] = (medewerkers ?? []).map(m => ({
    id:      m.id,
    name:    m.name,
    role:    m.role,
    userId:  m.user_id,
    email:   authMap.get(m.user_id)?.email ?? '',
    onHold:  authMap.get(m.user_id)?.onHold ?? false,
    isSelf:  m.user_id === userId,
  }))

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users size={20} className="text-[#1f1683]" />
          <h1 className="text-2xl font-bold text-[#1e293b]">Medewerkers</h1>
        </div>
        <p className="text-sm text-[#64748b]">Beheer medewerkers, rollen en toegang.</p>
      </div>

      <div className="space-y-6">
        <MedewerkersTable medewerkers={rows} />

        {/* Uitnodiging sturen */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden max-w-xl">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <h2 className="text-sm font-semibold text-[#475569]">Nieuwe medewerker uitnodigen</h2>
          </div>
          <div className="p-5">
            <UitnodigingForm />
          </div>
        </div>
      </div>
    </div>
  )
}
