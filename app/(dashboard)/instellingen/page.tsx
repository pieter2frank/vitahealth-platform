import { createClient } from '@/lib/supabase/server'
import { Settings, PackageOpen, Mail } from 'lucide-react'
import { SettingsForm } from './SettingsForm'
import { RetourAdresForm, type RetourAdres } from './RetourAdresForm'
import { DigestEmailForm } from './DigestEmailForm'

export default async function InstellingenPage() {
  const supabase = await createClient()

  const [{ data: questionnaires }, { data: setting }, { data: retourSetting }, { data: digestSetting }] = await Promise.all([
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
    supabase
      .from('vh_setting')
      .select('value')
      .eq('key', 'retour_adres')
      .maybeSingle(),
    supabase
      .from('vh_setting')
      .select('value')
      .eq('key', 'daily_digest_email')
      .maybeSingle(),
  ])

  let retourAdres: RetourAdres | null = null
  if (retourSetting?.value) {
    try { retourAdres = JSON.parse(retourSetting.value) as RetourAdres } catch { retourAdres = null }
  }

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

      {/* Retouradres */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm mt-6">
        <h2 className="text-sm font-semibold text-[#1e293b] mb-1 flex items-center gap-2">
          <PackageOpen size={15} className="text-[#94a3b8]" />
          Retouradres
        </h2>
        <p className="text-xs text-[#94a3b8] mb-5">
          Dit adres wordt gebruikt voor het PostNL-retourlabel dat met de testkit wordt meegestuurd.
          De cliënt plakt dit label op de retourzending.
        </p>
        <RetourAdresForm current={retourAdres} />
      </div>

      {/* Dagelijkse actie-mail */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm mt-6">
        <h2 className="text-sm font-semibold text-[#1e293b] mb-1 flex items-center gap-2">
          <Mail size={15} className="text-[#94a3b8]" />
          Dagelijkse actie-mail
        </h2>
        <p className="text-xs text-[#94a3b8] mb-5">
          Elke ochtend ontvangt dit adres een overzicht van openstaande acties — ingevulde
          vragenlijsten die de arts moet beoordelen en binnengekomen uitslagen die besproken
          moeten worden. De mail wordt alleen verstuurd als er daadwerkelijk acties openstaan.
        </p>
        <DigestEmailForm current={digestSetting?.value ?? null} />
      </div>
    </div>
  )
}
