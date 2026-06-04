import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import { UitnodigingForm } from './UitnodigingForm'

export const metadata = { title: 'Medewerkers — Vita Health' }

const ROLE_LABELS: Record<string, string> = {
  admin:         'Beheerder',
  arts:          'Arts',
  leefstijlarts: 'Leefstijlarts',
  medewerker:    'Medewerker',
}

const ROLE_COLORS: Record<string, string> = {
  admin:         'bg-slate-100 text-slate-700 border-slate-200',
  arts:          'bg-[#eef4ff] text-[#1f1683] border-[#c7d7fd]',
  leefstijlarts: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medewerker:    'bg-gray-50 text-gray-600 border-gray-200',
}

export default async function MedewerkersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Alleen admin
  const { data: self } = await supabase
    .from('vh_medewerker').select('role').eq('user_id', user.id).single()
  if (self?.role !== 'admin') redirect('/dashboard')

  // Alle medewerkers ophalen
  const { data: medewerkers } = await supabase
    .from('vh_medewerker')
    .select('id, name, role, created_at, user_id')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users size={20} className="text-[#1f1683]" />
            <h1 className="text-2xl font-bold text-[#1e293b]">Medewerkers</h1>
          </div>
          <p className="text-sm text-[#64748b]">
            Beheer medewerkers en stuur uitnodigingen.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Medewerkers lijst */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc]">
            <h2 className="text-sm font-semibold text-[#475569]">
              Huidige medewerkers ({(medewerkers ?? []).length})
            </h2>
          </div>
          <div className="divide-y divide-[#f1f5f9]">
            {(medewerkers ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-[#94a3b8]">Geen medewerkers gevonden.</p>
            ) : (medewerkers ?? []).map(m => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="h-8 w-8 rounded-full bg-[#eef4ff] flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-[#1f1683]">
                    {m.name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1e293b] truncate">{m.name}</p>
                  <p className="text-xs text-[#94a3b8]">
                    {m.user_id === user.id ? 'Jij' : 'Medewerker'}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[m.role] ?? ROLE_COLORS.medewerker}`}>
                  {ROLE_LABELS[m.role] ?? m.role}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Uitnodiging sturen */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
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
