import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { SettingsForm } from './SettingsForm'

export default async function InstellingenPage() {
  const supabase = await createClient()

  const [{ data: questionnaires }, { data: setting }] = await Promise.all([
    supabase
      .from('vh_questionnaire')
      .select('id, title')
      .eq('status', 'active')
      .order('title'),
    supabase
      .from('vh_setting')
      .select('value')
      .eq('key', 'intake_questionnaire_id')
      .maybeSingle(),
  ])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1e293b] flex items-center gap-2.5">
          <Settings size={22} className="text-[#94a3b8]" />
          Instellingen
        </h1>
        <p className="text-sm text-[#64748b] mt-0.5">Configureer de platforminstellingen.</p>
      </div>

      {/* Aanmeldprocedure */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e293b] mb-1">Aanmeldprocedure</h2>
        <p className="text-xs text-[#94a3b8] mb-5">
          Instellingen voor de portal-aanmeldprocedure voor nieuwe deelnemers.
        </p>
        <SettingsForm
          questionnaires={questionnaires ?? []}
          currentValue={setting?.value ?? null}
        />
      </div>
    </div>
  )
}
