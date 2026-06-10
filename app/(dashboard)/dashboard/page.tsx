import { createClient } from '@/lib/supabase/server'
import {
  TestTube2, Users, Building2, Package,
} from 'lucide-react'
import Link from 'next/link'
import { ActionsTable } from './ActionsTable'
import type { ActionType } from '@/lib/actions'

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
    { data: onHold },
    { data: toSendKit },
    { data: retourRaw },
    { data: resultsIn },
    { data: incomplete },
  ] = await Promise.all([
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'vragenlijst_ingevuld')
      .order('created_at', { ascending: false })
      .limit(8),
    // Intake geblokkeerd (mogelijke contra-indicatie) → arts
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'intake_on_hold')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'intake_akkoord')
      .order('created_at', { ascending: false })
      .limit(8),
    // Retour-kits die nog naar Nightingale moeten → medewerker
    supabase.from('vh_testkit')
      .select('id, barcode, retour_date, vh_client(first_name, last_name)')
      .eq('status', 'retour')
      .is('batch_id', null)
      .order('retour_date', { ascending: false })
      .limit(8),
    // Uitslag binnen → medewerker
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, created_at')
      .eq('enrollment_status', 'uitslag_bekend')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('vh_client')
      .select('id, first_name, last_name, email, enrollment_status, created_at')
      .in('enrollment_status', ['aangemeld', 'toestemming_gegeven'])
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  // ── Acties platmaken naar één lijst ───────────────────────────────────────
  type ActionRow = {
    key: string
    actionType: ActionType
    subjectId: string
    subjectLabel: string
    subjectSub: string | null
    href: string
    date: string
  }
  const actions: ActionRow[] = []
  const pushClient = (
    type: ActionType,
    rows: { id: string; first_name: string; last_name: string; email: string | null; created_at: string }[],
    subFn: (c: { email: string | null }) => string | null,
  ) => {
    for (const c of rows) {
      actions.push({
        key: `${type}:${c.id}`,
        actionType: type,
        subjectId: c.id,
        subjectLabel: `${c.first_name} ${c.last_name}`,
        subjectSub: subFn(c),
        href: `/clienten/${c.id}`,
        date: c.created_at,
      })
    }
  }

  pushClient('intake_review',  (toReview  ?? []) as never, c => c.email ?? null)
  pushClient('intake_blocked', (onHold    ?? []) as never, () => 'Mogelijke contra-indicatie')
  pushClient('kit_send',       (toSendKit ?? []) as never, c => c.email ?? null)
  pushClient('result_process', (resultsIn ?? []) as never, c => c.email ?? null)

  for (const kit of retourRaw ?? []) {
    const c = kit.vh_client as unknown as { first_name: string; last_name: string } | null
    actions.push({
      key: `kit_batch:${kit.id}`,
      actionType: 'kit_batch',
      subjectId: kit.id as string,
      subjectLabel: kit.barcode as string,
      subjectSub: c ? `${c.first_name} ${c.last_name}` : 'Niet toegewezen',
      href: `/testkits/${kit.id}`,
      date: (kit.retour_date as string | null) ?? new Date().toISOString(),
    })
  }

  for (const c of incomplete ?? []) {
    actions.push({
      key: `enrollment_incomplete:${c.id}`,
      actionType: 'enrollment_incomplete',
      subjectId: c.id,
      subjectLabel: `${c.first_name} ${c.last_name}`,
      subjectSub: c.enrollment_status === 'toestemming_gegeven' ? 'Gestopt na toestemmingen' : 'Gestopt na adresgegevens',
      href: `/clienten/${c.id}`,
      date: c.created_at,
    })
  }

  // ── Toewijzingen, medewerkers en huidige medewerker ───────────────────────
  const subjectIds = actions.map(a => a.subjectId)
  const [{ data: assignRaw }, { data: members }, { data: { user } }] = await Promise.all([
    subjectIds.length
      ? supabase.from('vh_action_assignment')
          .select('action_type, subject_id, assigned_to, vh_medewerker(name)')
          .in('subject_id', subjectIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('vh_medewerker').select('id, name, role').order('name'),
    supabase.auth.getUser(),
  ])

  const assignments: Record<string, { memberId: string; memberName: string }> = {}
  for (const a of assignRaw ?? []) {
    const m = a.vh_medewerker as unknown as { name: string } | null
    assignments[`${a.action_type}:${a.subject_id}`] = {
      memberId: a.assigned_to as string,
      memberName: m?.name ?? '—',
    }
  }

  let currentMemberId: string | null = null
  if (user) {
    const { data: meRow } = await supabase
      .from('vh_medewerker').select('id').eq('user_id', user.id).maybeSingle()
    currentMemberId = meRow?.id ?? null
  }

  return {
    testkit: { total: tkTotal ?? 0, received: tkReceived ?? 0, assigned: tkAssigned ?? 0, retour: tkRetour ?? 0, sent: tkSent ?? 0, results: tkResults ?? 0 },
    clientCounts,
    actions,
    assignments,
    members: (members ?? []) as { id: string; name: string; role: string }[],
    currentMemberId,
  }
}

// ─── Pagina ───────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { testkit, clientCounts, actions, assignments, members, currentMemberId } = await getData(supabase)

  const tkCards = [
    { label: 'Totaal testkits', value: testkit.total,    icon: TestTube2,  color: 'text-[#1f1683]', bg: 'bg-[#eef4ff]' },
    { label: 'Ontvangen',       value: testkit.received, icon: TestTube2,  color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Toegewezen',      value: testkit.assigned, icon: Users,      color: 'text-blue-600',   bg: 'bg-blue-50' },
    { label: 'Retour',          value: testkit.retour,   icon: Package,    color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Verzonden NHG',   value: testkit.sent,     icon: Building2,  color: 'text-cyan-600',   bg: 'bg-cyan-50' },
    { label: 'Resultaten',      value: testkit.results,  icon: TestTube2,  color: 'text-green-600',  bg: 'bg-green-50' },
  ]

  const pipeline: { key: keyof typeof clientCounts; label: string }[] = [
    { key: 'aangemeld',           label: 'Aangemeld' },
    { key: 'toestemming_gegeven', label: 'Toestemming' },
    { key: 'vragenlijst_ingevuld',label: 'Vragenlijst' },
    { key: 'intake_akkoord',      label: 'Intake akkoord' },
    { key: 'kit_opgestuurd',      label: 'Kit verstuurd' },
    { key: 'kit_retour',          label: 'Kit retour' },
    { key: 'uitslag_bekend',      label: 'Uitslag bekend' },
    { key: 'uitslag_besproken',   label: 'Uitslag besproken' },
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
          <div className="grid grid-cols-2 divide-x divide-y divide-[#f1f5f9] sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-8">
            {pipeline.map(({ key, label }) => {
              const count = clientCounts[key]
              return (
                <Link
                  key={key}
                  href={`/clienten?status=${key}`}
                  className="flex flex-col items-center justify-center gap-1 px-3 py-5 text-center hover:bg-[#f8fafc] transition-colors"
                >
                  <span className={`text-2xl font-semibold tabular-nums ${count > 0 ? 'text-[#1f1683]' : 'text-[#cbd5e1]'}`}>
                    {count}
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-[#94a3b8] leading-tight">
                    {label}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Rij 3: Actiepunten ─────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Actiepunten</SectionLabel>
        <ActionsTable
          actions={actions}
          members={members}
          assignments={assignments}
          currentMemberId={currentMemberId}
        />
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
