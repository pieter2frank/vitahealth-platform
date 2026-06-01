import { createClient } from '@/lib/supabase/server'
import {
  TestTube2, Users, Building2, Package,
  ClipboardCheck, Clock, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'

// ─── Data ophalen ─────────────────────────────────────────────────────────────

async function getData(supabase: Awaited<ReturnType<typeof createClient>>) {
  const ENROLLMENT_STATUSES = [
    'aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld', 'intake_akkoord',
    'kit_opgestuurd', 'kit_retour', 'uitslag_bekend', 'uitslag_besproken',
  ] as const

  // Testkit tellers
  const [
    { count: tkTotal },
    { count: tkReceived },
    { count: tkAssigned },
    { count: tkRetour },
    { count: tkSent },
    { count: tkResults },
  ] = await Promise.all([
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'received'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'assigned'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'retour'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'sent_nightingale'),
    supabase.from('vh_testkit').select('*', { count: 'exact', head: true }).eq('status', 'results_available'),
  ])

  // Cliëntstatus tellers (apart zodat de types kloppen)
  const clientCountResults = await Promise.all(
    ENROLLMENT_STATUSES.map(s =>
      supabase.from('vh_client').select('*', { count: 'exact', head: true }).eq('enrollment_status', s)
    )
  )
  const clientCounts = Object.fromEntries(
    ENROLLMENT_STATUSES.map((s, i) => [s, clientCountResults[i].count ?? 0])
  ) as Record<typeof ENROLLMENT_STATUSES[number], number>

  // Actielijsten
  const [
    { data: toReview },
    { data: toSendKit },
    { data: incomplete },
  ] = await Promise.all([
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'vragenlijst_ingevuld')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'intake_akkoord')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, enrollment_status, created_at')
      .in('enrollment_status', ['aangemeld', 'toestemming_gegeven'])
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return {
    testkit: { total: tkTotal ?? 0, received: tkReceived ?? 0, assigned: tkAssigned ?? 0, retour: tkRetour ?? 0, sent: tkSent ?? 0, results: tkResults ?? 0 },
    clientCounts,
    toReview:   toReview   ?? [],
    toSendKit:  toSendKit  ?? [],
    incomplete: incomplete ?? [],
  }
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { testkit, clientCounts, toReview, toSendKit, incomplete } = await getData(supabase)

  const tkCards = [
    { label: 'Totaal testkits', value: testkit.total,    icon: TestTube2,  color: 'text-[#1f1683]', bg: 'bg-[#eef4ff]' },
    { label: 'Ontvangen',       value: testkit.received, icon: TestTube2,  color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Toegewezen',      value: testkit.assigned, icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Retour',          value: testkit.retour,   icon: Package,    color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Verzonden NHG',   value: testkit.sent,     icon: Building2,  color: 'text-cyan-600',   bg: 'bg-cyan-50' },
    { label: 'Resultaten',      value: testkit.results,  icon: TestTube2,  color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  const pipeline: { key: keyof typeof clientCounts; label: string; color: string; dot: string }[] = [
    { key: 'aangemeld',           label: 'Aangemeld',         color: 'text-slate-600',  dot: 'bg-slate-400' },
    { key: 'toestemming_gegeven', label: 'Toestemming',       color: 'text-blue-600',   dot: 'bg-blue-400' },
    { key: 'vragenlijst_ingevuld',label: 'Vragenlijst',       color: 'text-violet-600', dot: 'bg-violet-500' },
    { key: 'intake_akkoord',      label: 'Intake akkoord',    color: 'text-amber-600',  dot: 'bg-amber-400' },
    { key: 'kit_opgestuurd',      label: 'Kit verstuurd',     color: 'text-orange-600', dot: 'bg-orange-400' },
    { key: 'kit_retour',          label: 'Kit retour',        color: 'text-purple-600', dot: 'bg-purple-400' },
    { key: 'uitslag_bekend',      label: 'Uitslag bekend',    color: 'text-teal-600',   dot: 'bg-teal-400' },
    { key: 'uitslag_besproken',   label: 'Uitslag besproken', color: 'text-green-600',  dot: 'bg-green-500' },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1e293b]">Dashboard</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Overzicht van het biomarker platform.</p>
      </div>

      {/* ── Rij 1: Testkits ────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Testkits</SectionLabel>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {tkCards.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-[#64748b] uppercase tracking-wide leading-tight">{label}</p>
                <div className={`rounded-lg p-1.5 ${bg} shrink-0`}>
                  <Icon size={14} className={color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#1e293b]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Rij 2: Cliënten per status ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Cliënten per status</SectionLabel>
          <Link href="/clienten" className="text-xs text-[#1f1683] hover:underline">
            Alle cliënten →
          </Link>
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          <div className="flex items-stretch overflow-x-auto">
            {pipeline.map(({ key, label, color, dot }, i) => {
              const count = clientCounts[key]
              const isLast = i === pipeline.length - 1
              return (
                <div key={key} className="flex items-stretch shrink-0">
                  <Link
                    href={`/clienten?status=${key}`}
                    className="flex flex-col items-center justify-center px-5 py-4 min-w-[110px] hover:bg-[#f8fafc] transition-colors group"
                  >
                    <div className={`flex items-center gap-1.5 mb-2`}>
                      <span className={`h-2 w-2 rounded-full ${dot}`} />
                      <span className={`text-[11px] font-medium uppercase tracking-wide ${color}`}>{label}</span>
                    </div>
                    <span className={`text-2xl font-bold ${count > 0 ? 'text-[#1e293b]' : 'text-[#cbd5e1]'}`}>
                      {count}
                    </span>
                  </Link>
                  {!isLast && (
                    <div className="flex items-center self-center text-[#e2e8f0]">
                      <ChevronRight size={16} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Rij 3: Actiepunten ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Actiepunten</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Arts: intake beoordelen */}
          <ActionCard
            icon={<ClipboardCheck size={16} className="text-violet-600" />}
            iconBg="bg-violet-50"
            title="Intake beoordelen"
            badge="Arts"
            badgeColor="bg-violet-100 text-violet-700"
            count={toReview.length}
            countStatus="vragenlijst_ingevuld"
            emptyText="Geen intakes wachten op beoordeling."
          >
            {toReview.map(c => (
              <ClientRow
                key={c.id}
                id={c.id}
                name={`${c.first_name} ${c.last_name}`}
                sub={c.email ?? undefined}
                date={c.created_at}
              />
            ))}
          </ActionCard>

          {/* Medewerker: kit versturen */}
          <ActionCard
            icon={<Package size={16} className="text-amber-600" />}
            iconBg="bg-amber-50"
            title="Kit versturen"
            badge="Medewerker"
            badgeColor="bg-amber-100 text-amber-700"
            count={toSendKit.length}
            countStatus="intake_akkoord"
            emptyText="Geen kits klaarstaan voor verzending."
          >
            {toSendKit.map(c => (
              <ClientRow
                key={c.id}
                id={c.id}
                name={`${c.first_name} ${c.last_name}`}
                sub={c.email ?? undefined}
                date={c.created_at}
              />
            ))}
          </ActionCard>

          {/* Aanmelding niet afgerond */}
          <ActionCard
            icon={<Clock size={16} className="text-slate-500" />}
            iconBg="bg-slate-50"
            title="Aanmelding niet afgerond"
            badge="Medewerker"
            badgeColor="bg-slate-100 text-slate-600"
            count={incomplete.length}
            countStatus={null}
            emptyText="Alle aanmeldingen zijn volledig afgerond."
          >
            {incomplete.map(c => (
              <ClientRow
                key={c.id}
                id={c.id}
                name={`${c.first_name} ${c.last_name}`}
                sub={
                  c.enrollment_status === 'toestemming_gegeven'
                    ? 'Gestopt na toestemmingen'
                    : 'Gestopt na adresgegevens'
                }
                date={c.created_at}
                resumeEmail={c.email ?? undefined}
              />
            ))}
          </ActionCard>

        </div>
      </section>
    </div>
  )
}

// ─── Subcomponenten ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8] mb-3">{children}</p>
  )
}

function ActionCard({
  icon, iconBg, title, badge, badgeColor,
  count, countStatus, emptyText, children,
}: {
  icon: React.ReactNode
  iconBg: string
  title: string
  badge: string
  badgeColor: string
  count: number
  countStatus: string | null
  emptyText: string
  children: React.ReactNode
}) {
  const hasItems = count > 0
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#f1f5f9] px-4 py-3">
        <div className={`rounded-lg p-1.5 ${iconBg} shrink-0`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#1e293b] truncate">{title}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badge}</span>
          {hasItems && (
            <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-xs font-bold">{count}</span>
          )}
        </div>
      </div>

      {/* Lijst */}
      <div className="flex-1 divide-y divide-[#f8fafc]">
        {!hasItems ? (
          <p className="px-4 py-6 text-center text-sm text-[#94a3b8]">{emptyText}</p>
        ) : (
          children
        )}
      </div>

      {/* Footer met link naar volledige lijst */}
      {hasItems && countStatus && (
        <div className="border-t border-[#f1f5f9] px-4 py-2.5">
          <Link
            href={`/clienten?status=${countStatus}`}
            className="text-xs text-[#1f1683] hover:underline"
          >
            Alle {count} bekijken →
          </Link>
        </div>
      )}
    </div>
  )
}

function ClientRow({
  id, name, sub, date, resumeEmail,
}: {
  id: string
  name: string
  sub?: string
  date: string
  resumeEmail?: string
}) {
  const ago = formatDistanceToNow(new Date(date), { locale: nl, addSuffix: true })
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[#f8fafc] transition-colors">
      <div className="min-w-0 flex-1">
        <Link href={`/clienten/${id}`} className="text-sm font-medium text-[#1e293b] hover:text-[#1f1683] truncate block">
          {name}
        </Link>
        {sub && <p className="text-xs text-[#94a3b8] truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#cbd5e1]">{ago}</span>
        {resumeEmail && (
          <Link
            href={`/portal/aanmelden?email=${encodeURIComponent(resumeEmail)}`}
            className="rounded border border-[#e2e8f0] px-2 py-0.5 text-xs text-[#64748b] hover:border-[#1f1683] hover:text-[#1f1683] transition-colors"
            title="Stuur hervatlink"
          >
            Hervatten
          </Link>
        )}
      </div>
    </div>
  )
}
