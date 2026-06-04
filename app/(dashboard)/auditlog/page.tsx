import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export const metadata = { title: 'Auditlog — Vita Health' }

const ACTION_LABELS: Record<string, string> = {
  view:           'Ingezien',
  create:         'Aangemaakt',
  update:         'Gewijzigd',
  delete:         'Verwijderd',
  export:         'Geëxporteerd',
  email_sent:     'E-mail verstuurd',
  status_change:  'Status gewijzigd',
  access_granted: 'Toegang verleend',
  access_denied:  'Toegang geweigerd',
}

const RESOURCE_LABELS: Record<string, string> = {
  client:                    'Cliëntdossier',
  questionnaire_response:    'Vragenlijstresultaten',
  questionnaire_assignment:  'Vragenlijstopdracht',
  testkit:                   'Testkit',
  batch_export:              'Batch export',
  consent:                   'Toestemming',
  enrollment_status:         'Aanmeldstatus',
  kit_status:                'Kitstatus',
}

const OUTCOME_ICON = {
  success: <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
  denied:  <XCircle     size={14} className="text-red-500    shrink-0" />,
  failed:  <AlertTriangle size={13} className="text-orange-500 shrink-0" />,
}

const OUTCOME_STYLE = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  denied:  'bg-red-50    text-red-700    border-red-200',
  failed:  'bg-orange-50 text-orange-700 border-orange-200',
}

export default async function AuditlogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; resource?: string; page?: string }>
}) {
  // ── Toegang: alleen admin ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  // ── Filters & paginering ───────────────────────────────────────────────────
  const { action, resource, page: pageParam } = await searchParams
  const PAGE_SIZE = 50
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  // ── Data ophalen via admin client (audit schema) ───────────────────────────
  const admin = createAdminClient()

  let query = admin
    .from('vh_events')
    .select(`
      id, created_at,
      actor_user_id, actor_role,
      subject_client_id,
      resource_type, resource_id,
      action, reason, outcome, denial_reason,
      metadata
    `, { count: 'exact' })
    .schema('audit')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (action)   query = query.eq('action', action)
  if (resource) query = query.eq('resource_type', resource)

  const { data: events, count } = await query

  // ── Medewerkersnamen ophalen voor actor_user_id's ──────────────────────────
  const actorIds = [...new Set((events ?? []).map(e => e.actor_user_id).filter(Boolean))]
  const { data: profiles } = actorIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', actorIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

  // ── Cliëntnamen ophalen voor subject_client_id's ───────────────────────────
  const clientIds = [...new Set((events ?? []).map(e => e.subject_client_id).filter(Boolean))]
  const { data: clients } = clientIds.length
    ? await admin.from('vh_client').select('id, first_name, last_name').in('id', clientIds)
    : { data: [] }

  const clientMap = Object.fromEntries((clients ?? []).map(c => [c.id, c]))

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={20} className="text-[#1f1683]" />
            <h1 className="text-2xl font-bold text-[#1e293b]">Auditlog</h1>
          </div>
          <p className="text-sm text-[#64748b]">
            Toegangslog voor medische gegevens — conform NEN 7513. Alleen zichtbaar voor admins.
          </p>
        </div>
        <div className="text-right text-xs text-[#94a3b8]">
          {count ?? 0} events totaal
        </div>
      </div>

      {/* Filters — server-side via links */}
      <div className="mb-5 flex items-center gap-2 flex-wrap">
        {/* Actie-filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-[#64748b] mr-1">Actie:</span>
          <a href={`/auditlog${resource ? `?resource=${resource}` : ''}`}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${!action ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683]'}`}>
            Alle
          </a>
          {Object.entries(ACTION_LABELS).map(([v, l]) => (
            <a key={v} href={`/auditlog?action=${v}${resource ? `&resource=${resource}` : ''}`}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${action === v ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683]'}`}>
              {l}
            </a>
          ))}
        </div>

        {/* Resource-filter */}
        <div className="flex items-center gap-1 flex-wrap mt-1">
          <span className="text-xs text-[#64748b] mr-1">Resource:</span>
          <a href={`/auditlog${action ? `?action=${action}` : ''}`}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${!resource ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683]'}`}>
            Alle
          </a>
          {Object.entries(RESOURCE_LABELS).map(([v, l]) => (
            <a key={v} href={`/auditlog?resource=${v}${action ? `&action=${action}` : ''}`}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${resource === v ? 'bg-[#1f1683] text-white border-[#1f1683]' : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683]'}`}>
              {l}
            </a>
          ))}
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Tijdstip</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Medewerker</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Cliënt</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Actie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Resultaat</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Toelichting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {(events ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[#94a3b8]">
                    Geen audit events gevonden.
                  </td>
                </tr>
              ) : (events ?? []).map(e => {
                const actor  = profileMap[e.actor_user_id]
                const client = clientMap[e.subject_client_id]
                const outcome = e.outcome as 'success' | 'denied' | 'failed'

                return (
                  <tr key={e.id} className="hover:bg-[#f8fafc]">
                    {/* Tijdstip */}
                    <td className="px-4 py-3 text-xs text-[#64748b] whitespace-nowrap">
                      {format(new Date(e.created_at), 'd MMM yyyy HH:mm', { locale: nl })}
                    </td>

                    {/* Medewerker */}
                    <td className="px-4 py-3">
                      {actor ? (
                        <div>
                          <p className="text-sm font-medium text-[#1e293b]">{actor.full_name ?? actor.email}</p>
                          <p className="text-xs text-[#94a3b8]">{e.actor_role}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-[#94a3b8]">
                          {e.actor_role === 'portaal_eigen_data' ? 'Portaalgebruiker' : e.actor_user_id ? `ID: ${e.actor_user_id.slice(0, 8)}…` : '—'}
                        </span>
                      )}
                    </td>

                    {/* Cliënt */}
                    <td className="px-4 py-3 text-sm text-[#475569]">
                      {client
                        ? `${client.first_name} ${client.last_name}`
                        : e.subject_client_id
                          ? <span className="text-xs text-[#94a3b8]">{e.subject_client_id.slice(0, 8)}…</span>
                          : '—'
                      }
                    </td>

                    {/* Actie */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border bg-[#eef4ff] text-[#1f1683] border-[#c7d7fd] px-2 py-0.5 text-xs font-medium">
                        {ACTION_LABELS[e.action] ?? e.action}
                      </span>
                    </td>

                    {/* Resource */}
                    <td className="px-4 py-3 text-xs text-[#64748b]">
                      {RESOURCE_LABELS[e.resource_type] ?? e.resource_type}
                    </td>

                    {/* Resultaat */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${OUTCOME_STYLE[outcome] ?? ''}`}>
                        {OUTCOME_ICON[outcome]}
                        {outcome === 'success' ? 'Geslaagd' : outcome === 'denied' ? 'Geweigerd' : 'Mislukt'}
                      </span>
                    </td>

                    {/* Toelichting */}
                    <td className="px-4 py-3 text-xs text-[#64748b] max-w-xs truncate">
                      {e.reason ?? e.denial_reason ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Paginering */}
        {totalPages > 1 && (
          <div className="border-t border-[#f1f5f9] px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-[#64748b]">
              Pagina {page} van {totalPages} ({count} events)
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <a
                  href={`/auditlog?page=${page - 1}${action ? `&action=${action}` : ''}${resource ? `&resource=${resource}` : ''}`}
                  className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#f8fafc]"
                >
                  ← Vorige
                </a>
              )}
              {page < totalPages && (
                <a
                  href={`/auditlog?page=${page + 1}${action ? `&action=${action}` : ''}${resource ? `&resource=${resource}` : ''}`}
                  className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#f8fafc]"
                >
                  Volgende →
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
