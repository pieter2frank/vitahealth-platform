import { createAdminClient } from '@/lib/supabase/admin'
import { canSeeResults } from '@/lib/auth/roles'
import { FOLLOWUP_DOMAINS } from '@/lib/annotation'
import { ClipboardList, CheckCircle2, Clock, ShieldCheck, Timer } from 'lucide-react'

const DOM: Record<string, string> = Object.fromEntries(FOLLOWUP_DOMAINS.map(d => [d.value, d.label]))

function fmtDuur(sec: number): string {
  if (!sec || sec < 60) return '< 1 min'
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  const u = Math.floor(m / 60), r = m % 60
  return r ? `${u} u ${r} min` : `${u} u`
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'
}

interface Ann {
  id: string; round_id: string; arts_user_id: string
  algemeen_beeld: string | null; bespreken_team: boolean | null; advies: string | null
  verbeterpotentieel: number | null; vervolg_domeinen: string[] | null; wearables_nuttig: boolean | null
  status: string; time_spent_seconds: number | null
}
interface HL { annotation_id: string; selected_text: string; note: string | null }

export async function AnnotationsSection({ clientId, viewerRole }: { clientId: string; viewerRole?: string }) {
  if (!canSeeResults(viewerRole)) return null

  const admin = createAdminClient()
  const { data: annsRaw } = await admin
    .from('vh_annotation')
    .select('id, round_id, arts_user_id, algemeen_beeld, bespreken_team, advies, verbeterpotentieel, vervolg_domeinen, wearables_nuttig, status, time_spent_seconds')
    .eq('client_id', clientId)
  const anns = (annsRaw ?? []) as Ann[]
  if (anns.length === 0) return null

  const roundIds = [...new Set(anns.map(a => a.round_id))]
  const artsIds  = [...new Set(anns.map(a => a.arts_user_id))]
  const [{ data: rounds }, { data: med }, { data: hls }] = await Promise.all([
    admin.from('vh_annotation_round').select('id, title, created_at').in('id', roundIds),
    admin.from('vh_medewerker').select('user_id, name').in('user_id', artsIds),
    admin.from('vh_annotation_highlight').select('annotation_id, selected_text, note').in('annotation_id', anns.map(a => a.id)),
  ])
  const roundTitle = new Map((rounds ?? []).map(r => [r.id as string, r.title as string]))
  const roundOrder = new Map((rounds ?? []).map(r => [r.id as string, r.created_at as string]))
  const artsName = new Map((med ?? []).map(m => [m.user_id as string, m.name as string]))
  const hlByAnn = new Map<string, HL[]>()
  for (const h of (hls ?? []) as HL[]) { const l = hlByAnn.get(h.annotation_id) ?? []; l.push(h); hlByAnn.set(h.annotation_id, l) }

  // Groepeer per ronde, nieuwste ronde eerst.
  const byRound = new Map<string, Ann[]>()
  for (const a of anns) { const l = byRound.get(a.round_id) ?? []; l.push(a); byRound.set(a.round_id, l) }
  const orderedRounds = [...byRound.keys()].sort((x, y) => (roundOrder.get(y) ?? '').localeCompare(roundOrder.get(x) ?? ''))

  return (
    <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-[#e2e8f0] px-5 py-4">
        <ClipboardList size={15} className="text-[#94a3b8]" />
        <h2 className="text-sm font-semibold text-[#1e293b]">Annotaties</h2>
        <span className="text-xs text-[#94a3b8]">({anns.length})</span>
      </div>

      <div className="divide-y divide-[#f1f5f9]">
        {orderedRounds.map(rid => {
          const list = byRound.get(rid)!.slice().sort((a, b) => (artsName.get(a.arts_user_id) ?? '').localeCompare(artsName.get(b.arts_user_id) ?? ''))
          const done = list.filter(a => a.status === 'ingediend')
          const n = done.length

          // Consensus (alleen ingediend)
          const vps = done.map(a => a.verbeterpotentieel).filter((v): v is number => v != null)
          const avg = vps.length ? vps.reduce((s, v) => s + v, 0) / vps.length : null
          const vmin = vps.length ? Math.min(...vps) : null
          const vmax = vps.length ? Math.max(...vps) : null
          const domCount = new Map<string, number>()
          for (const a of done) for (const d of a.vervolg_domeinen ?? []) domCount.set(d, (domCount.get(d) ?? 0) + 1)
          const domSorted = [...domCount.entries()].sort((a, b) => b[1] - a[1])
          const teamJa = done.filter(a => a.bespreken_team === true).length
          const wearJa = done.filter(a => a.wearables_nuttig === true).length
          const times = list.map(a => a.time_spent_seconds ?? 0).filter(t => t > 0)
          const avgTime = times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0

          return (
            <div key={rid} className="px-5 py-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-[#1e293b]">{roundTitle.get(rid) ?? 'Ronde'}</span>
                <span className="text-xs text-[#94a3b8]">· {list.length} annotatie{list.length === 1 ? '' : 's'} ({n} ingediend)</span>
              </div>

              {/* Consensus */}
              {n > 0 ? (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Verbeterpotentieel</p>
                    {avg != null ? (
                      <>
                        <p className="text-2xl font-bold leading-none text-[#1f1683]">
                          {avg.toFixed(1).replace('.', ',')}
                          <span className="ml-2 text-xs font-medium text-[#94a3b8]">gem. · range {vmin}–{vmax}</span>
                        </p>
                        <div className="relative mx-1 mt-3 h-1.5 rounded-full bg-[#e2e8f0]">
                          {vps.map((v, i) => (
                            <span key={i} className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-amber-500" style={{ left: `${v * 10}%` }} />
                          ))}
                          <span className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded bg-[#1f1683]" style={{ left: `${avg * 10}%` }} />
                        </div>
                        <div className="mt-1 flex justify-between text-[10px] text-[#94a3b8]"><span>0 · weinig</span><span>veel · 10</span></div>
                      </>
                    ) : <p className="text-sm text-[#94a3b8]">—</p>}
                  </div>

                  <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Vervolg-domeinen (genoemd door)</p>
                    {domSorted.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {domSorted.map(([d, c]) => (
                          <span key={d} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${c === n ? 'border-[#17e4a1] bg-[#17e4a1]/15 text-[#0d7a5f]' : 'border-[#e2e8f0] bg-white text-[#64748b]'}`}>
                            {DOM[d] ?? d} <b className={c === n ? 'text-[#0d7a5f]' : 'text-[#1f1683]'}>{c}/{n}</b>
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-sm text-[#94a3b8]">—</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Bespreken in team</p>
                      <p className="text-lg font-bold text-[#1e293b]">{teamJa}<span className="ml-1 text-xs font-medium text-[#94a3b8]">/ {n} ja</span></p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Wearables nuttig</p>
                      <p className="text-lg font-bold text-[#1e293b]">{wearJa}<span className="ml-1 text-xs font-medium text-[#94a3b8]">/ {n} ja</span></p>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Gem. beoordelingstijd</p>
                      <p className="flex items-center gap-1 text-lg font-bold text-[#1e293b]"><Timer size={14} className="text-[#94a3b8]" />{avgTime ? fmtDuur(avgTime) : '—'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mb-4 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm text-[#94a3b8]">Nog geen ingediende annotaties in deze ronde.</p>
              )}

              {/* Per arts */}
              <div className="grid gap-3 lg:grid-cols-2">
                {list.map(a => {
                  const nm = artsName.get(a.arts_user_id) ?? '—'
                  const isDone = a.status === 'ingediend'
                  const hl = hlByAnn.get(a.id) ?? []
                  return (
                    <div key={a.id} className={`rounded-xl border p-3.5 ${isDone ? 'border-[#e2e8f0] bg-white' : 'border-dashed border-[#e2e8f0] bg-[#fbfcfe]'}`}>
                      <div className="mb-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c7d7fd] bg-[#eef4ff] text-xs font-bold text-[#1f1683]">{initials(nm)}</span>
                          <div>
                            <p className="text-sm font-semibold text-[#1e293b]">{nm}</p>
                            <p className="text-[10px] font-semibold text-[#1f1683]">Medisch Team</p>
                          </div>
                        </div>
                        {isDone
                          ? <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700"><ShieldCheck size={11} /> Ingediend</span>
                          : <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><Clock size={11} /> Concept</span>}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748b]">
                        {a.verbeterpotentieel != null && <span>Potentieel <b className="text-[#1e293b]">{a.verbeterpotentieel}</b>/10</span>}
                        <span className="inline-flex items-center gap-1"><Timer size={12} /> {fmtDuur(a.time_spent_seconds ?? 0)}</span>
                        {a.bespreken_team != null && <span>Team: {a.bespreken_team ? 'ja' : 'nee'}</span>}
                        {a.wearables_nuttig != null && <span>Wearables: {a.wearables_nuttig ? 'ja' : 'nee'}</span>}
                      </div>

                      {(a.vervolg_domeinen ?? []).length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {(a.vervolg_domeinen ?? []).map(d => <span key={d} className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] text-[#64748b]">{DOM[d] ?? d}</span>)}
                        </div>
                      )}

                      {a.algemeen_beeld && (<><p className="mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b8]">Algemeen beeld</p><p className="text-[13px] text-[#334155]">{a.algemeen_beeld}</p></>)}
                      {a.advies && (<><p className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b8]">Advies</p><p className="whitespace-pre-wrap text-[13px] text-[#334155]">{a.advies}</p></>)}

                      {hl.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {hl.map((h, i) => (
                            <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-1.5">
                              <p className="truncate text-[11px] italic text-[#8a6d3b]">&ldquo;{h.selected_text}&rdquo;</p>
                              {h.note && <p className="text-[13px] text-[#334155]">{h.note}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
