import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CheckCircle2, Clock, Circle, AlertCircle, Ban } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'

// ─── Statusstappen (publieksvriendelijke teksten) ─────────────────────────────

type StepKey =
  | 'aangemeld'
  | 'toestemming_gegeven'
  | 'vragenlijst_ingevuld'
  | 'intake_akkoord'
  | 'kit_opgestuurd'
  | 'kit_retour'
  | 'uitslag_bekend'
  | 'uitslag_besproken'

interface Step {
  key: StepKey
  label: string
  description: string
  actie?: string   // wie moet wat doen in deze stap
  getDate?: (data: StatusData) => string | null | undefined
}

interface StatusData {
  first_name: string
  enrollment_status: string
  registered_at: string
  kit_status: string | null
  kit_retour_date: string | null
  kit_results_date: string | null
  has_order?: boolean
  paid?: boolean
  paid_at?: string | null
  refunded_at?: string | null
}

// Betaalstap (alleen getoond als er een order is). Staat vóór de intakestappen.
const PAYMENT_STEP: Step = {
  key: 'betaling' as StepKey,
  label: 'Betaling voldaan',
  description: 'Je bestelling is betaald. De factuur staat in je e-mail.',
  getDate: d => d.paid_at,
}

const STEPS: Step[] = [
  {
    key: 'aangemeld',
    label: 'Aanmelding ontvangen',
    description: 'Jouw gegevens zijn geregistreerd.',
    getDate: d => d.registered_at,
  },
  {
    key: 'toestemming_gegeven',
    label: 'Toestemmingen gegeven',
    description: 'Je hebt alle toestemmingsverklaringen bevestigd.',
  },
  {
    key: 'vragenlijst_ingevuld',
    label: 'Vragenlijst ingevuld',
    description: 'Je gezondheidsvragenlijst is ontvangen.',
    actie: 'Een medisch deskundige beoordeelt jouw intake.',
  },
  {
    key: 'intake_akkoord',
    label: 'Intake goedgekeurd',
    description: 'De arts heeft jouw intake beoordeeld en goedgekeurd.',
    actie: 'Vita Health verstuurt jouw testkit.',
  },
  {
    key: 'kit_opgestuurd',
    label: 'Testkit verstuurd',
    description: 'Jouw testkit is onderweg naar jouw adres.',
    actie: 'Volg de instructies in de doos voor de vingerprik en stuur het sample retour.',
  },
  {
    key: 'kit_retour',
    label: 'Sample ontvangen',
    description: 'Jouw bloedmonster is door ons ontvangen en wordt geanalyseerd.',
    actie: 'Het laboratorium analyseert jouw sample. Dit duurt ongeveer 10-14 werkdagen.',
    getDate: d => d.kit_retour_date,
  },
  {
    key: 'uitslag_bekend',
    label: 'Uitslag beschikbaar',
    description: 'De resultaten van jouw Vita Health Check zijn ontvangen.',
    actie: 'Een arts bekijkt jouw uitslag en neemt contact met je op.',
    getDate: d => d.kit_results_date,
  },
  {
    key: 'uitslag_besproken',
    label: 'Uitslag besproken',
    description: 'De arts heeft jouw uitslag met je besproken. Het traject is afgerond.',
  },
]

const STATUS_ORDER: StepKey[] = STEPS.map(s => s.key)

function statusIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status as StepKey)
  return idx === -1 ? 0 : idx
}

function fmt(date: string | null | undefined): string | null {
  if (!date) return null
  try { return format(new Date(date), 'd MMMM yyyy', { locale: nl }) } catch { return null }
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default async function StatusPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .rpc('get_enrollment_status_by_token', { p_token: token })

  if (error || !data?.exists) notFound()

  const d = data as StatusData
  const hasOrder = Boolean(d.has_order)
  // Betaalstap vooraan als er een order is; de intakestappen schuiven dan één op.
  const steps = hasOrder ? [PAYMENT_STEP, ...STEPS] : STEPS
  const currentIdx = statusIndex(d.enrollment_status) + (hasOrder ? 1 : 0)
  const isAfgewezen   = d.enrollment_status === 'intake_afgewezen'
  const isGeannuleerd = d.enrollment_status === 'geannuleerd'
  const refundedOn    = fmt(d.refunded_at)

  return (
    <main className="min-h-screen bg-[#f8fafc] py-10 px-4">
      <div className="mx-auto max-w-lg">

        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-[#1f1683] flex items-center justify-center">
              <span className="text-white text-xs font-bold">VH</span>
            </div>
            <span className="font-semibold text-[#1e293b]">Vita Health</span>
          </div>
          <h1 className="text-xl font-bold text-[#1e293b]">Status van jouw aanmelding</h1>
          <p className="text-sm text-[#64748b] mt-1">Hallo {d.first_name}, hier zie je hoe het staat met jouw Vita Health Check.</p>
        </div>

        {/* Intake afgewezen */}
        {isAfgewezen && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-6 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Intake niet goedgekeurd</p>
              <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
                De arts heeft jouw intake helaas niet kunnen goedkeuren. Je ontvangt of hebt al persoonlijk bericht ontvangen over de reden en eventuele vervolgstappen.
              </p>
            </div>
          </div>
        )}

        {/* Traject beëindigd (terugbetaald) */}
        {isGeannuleerd && (
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 mb-6 flex items-start gap-3">
            <Ban size={18} className="text-[#64748b] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#1e293b]">Traject beëindigd</p>
              <p className="text-xs text-[#64748b] mt-0.5 leading-relaxed">
                Je aanmelding is stopgezet en je betaling is teruggestort{refundedOn ? ` op ${refundedOn}` : ''}. De creditfactuur staat in je e-mail. Wil je later alsnog een test doen? Je bent altijd welkom om je opnieuw aan te melden.
              </p>
            </div>
          </div>
        )}

        {/* Tijdlijn */}
        {!isGeannuleerd && (
        <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          <div className="border-b border-[#f1f5f9] px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">Voortgang</p>
          </div>
          <div className="px-6 py-5 space-y-0">
            {steps.map((step, i) => {
              const stepIdx      = i
              const isDone       = stepIdx < currentIdx && !isAfgewezen
              const isCurrent    = stepIdx === currentIdx && !isAfgewezen
              const isFuture     = stepIdx > currentIdx || isAfgewezen
              const isLast       = i === steps.length - 1
              const date         = fmt(step.getDate?.(d))

              return (
                <div key={step.key} className="flex gap-4">
                  {/* Icoon + lijn */}
                  <div className="flex flex-col items-center">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isDone    ? 'bg-[#1f1683] border-[#1f1683]' :
                      isCurrent ? 'bg-white border-[#1f1683]'     :
                                  'bg-white border-[#e2e8f0]'
                    }`}>
                      {isDone    ? <CheckCircle2 size={16} className="text-white" /> :
                       isCurrent ? <Clock size={15} className="text-[#1f1683]" /> :
                                   <Circle size={14} className="text-[#d1d5db]" />}
                    </div>
                    {!isLast && (
                      <div className={`w-0.5 flex-1 my-1 ${isDone ? 'bg-[#1f1683]/30' : 'bg-[#f1f5f9]'}`}
                        style={{ minHeight: '20px' }} />
                    )}
                  </div>

                  {/* Tekst */}
                  <div className={`pb-5 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-snug ${
                        isDone    ? 'text-[#64748b]' :
                        isCurrent ? 'text-[#1f1683]' :
                                    'text-[#cbd5e1]'
                      }`}>
                        {step.label}
                        {isCurrent && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-medium text-[#1f1683]">
                            huidig
                          </span>
                        )}
                      </p>
                      {date && (isDone || isCurrent) && (
                        <span className="text-xs text-[#94a3b8] shrink-0">{date}</span>
                      )}
                    </div>
                    {(isDone || isCurrent) && (
                      <p className={`text-xs mt-0.5 leading-relaxed ${isCurrent ? 'text-[#475569]' : 'text-[#94a3b8]'}`}>
                        {step.description}
                      </p>
                    )}
                    {isCurrent && step.actie && (
                      <p className="text-xs mt-1.5 text-[#1f1683] font-medium">
                        ↳ {step.actie}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* Contactblok */}
        <div className="mt-6 rounded-xl border border-[#e2e8f0] bg-white p-5 text-center">
          <p className="text-sm text-[#64748b] leading-relaxed">
            Vragen over jouw aanmelding of testkit?<br />
            Bezoek onze{' '}
            <a href="https://helpdesk.vita-health.nl" className="text-[#1f1683] font-medium hover:underline">
              helpdesk
            </a>
          </p>
        </div>

      </div>
    </main>
  )
}
