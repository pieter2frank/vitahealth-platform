import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { caseLabel } from '@/lib/annotation'
import { ClipboardList, CheckCircle2, Clock, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

type ClientRel = { gender: string | null; birth_date: string | null }
interface CaseRow { id: string; round_id: string; client_id: string; vh_client: ClientRel | ClientRel[] | null }

export default async function AnnotatieHome() {
  const { userId, role } = await requireAnnotationAccess(['arts', 'leefstijlarts', 'admin'])
  if (role === 'admin') redirect('/admin')

  const admin = createAdminClient()

  const { data: rounds } = await admin
    .from('vh_annotation_round')
    .select('id, title, note, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  const roundIds = (rounds ?? []).map(r => r.id)

  const { data: cases } = roundIds.length
    ? await admin
        .from('vh_annotation_case')
        .select('id, round_id, client_id, vh_client ( gender, birth_date )')
        .in('round_id', roundIds)
    : { data: [] as CaseRow[] }

  const { data: mine } = await admin
    .from('vh_annotation')
    .select('round_id, client_id, status')
    .eq('arts_user_id', userId)

  const statusByCase = new Map((mine ?? []).map(m => [`${m.round_id}:${m.client_id}`, m.status as string]))
  const casesByRound = new Map<string, CaseRow[]>()
  for (const c of (cases ?? []) as CaseRow[]) {
    const list = casesByRound.get(c.round_id) ?? []
    list.push(c)
    casesByRound.set(c.round_id, list)
  }

  const totalOpen = (cases ?? []).filter(c => (statusByCase.get(`${c.round_id}:${c.client_id}`) ?? 'open') !== 'ingediend').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1e293b]">Casussen om te annoteren</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          {totalOpen > 0
            ? `Je hebt nog ${totalOpen} casus${totalOpen === 1 ? '' : 'sen'} te annoteren.`
            : 'Je bent helemaal bij — geen openstaande casussen.'}
        </p>
      </div>

      {(rounds ?? []).length === 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
          <ClipboardList size={22} className="mx-auto mb-2 text-[#cbd5e1]" />
          <p className="text-sm text-[#94a3b8]">Er staan momenteel geen rondes klaar.</p>
        </div>
      )}

      {(rounds ?? []).map(round => {
        const list = casesByRound.get(round.id) ?? []
        return (
          <section key={round.id} className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
            <div className="border-b border-[#e2e8f0] px-5 py-3.5">
              <h2 className="text-sm font-semibold text-[#1e293b]">{round.title}</h2>
              {round.note && <p className="mt-0.5 text-xs text-[#94a3b8]">{round.note}</p>}
            </div>
            <ul className="divide-y divide-[#f1f5f9]">
              {list.map(c => {
                const client = Array.isArray(c.vh_client) ? c.vh_client[0] : c.vh_client
                const status = statusByCase.get(`${c.round_id}:${c.client_id}`) ?? 'open'
                const done = status === 'ingediend'
                const concept = status === 'concept'
                return (
                  <li key={c.id}>
                    <Link href={`/casus/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-[#f8fafc] transition-colors">
                      <span className="text-sm font-medium text-[#1e293b]">
                        {caseLabel(client?.birth_date ?? null, client?.gender ?? null)}
                      </span>
                      <span className="flex items-center gap-3">
                        {done ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 size={11} /> Ingediend
                          </span>
                        ) : concept ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            <Clock size={11} /> Concept
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Nog te doen
                          </span>
                        )}
                        <ChevronRight size={15} className="text-[#cbd5e1]" />
                      </span>
                    </Link>
                  </li>
                )
              })}
              {list.length === 0 && (
                <li className="px-5 py-4 text-sm text-[#94a3b8]">Geen casussen in deze ronde.</li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
