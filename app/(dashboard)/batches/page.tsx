import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Package, Plus, TestTube2, CheckCircle2, Clock } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'

export default async function BatchesPage() {
  const supabase = await createClient()

  const [{ data: batches }, { count: retourCount }, { data: batchKits }] = await Promise.all([
    supabase
      .from('vh_batch')
      .select('id, badge_id, sent_date, status, results_date, created_at')
      .order('sent_date', { ascending: false }),
    supabase
      .from('vh_testkit')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'retour'),
    supabase
      .from('vh_testkit')
      .select('batch_id')
      .not('batch_id', 'is', null),
  ])

  // Kits per batch tellen
  const countByBatch = (batchKits ?? []).reduce<Record<string, number>>((acc, k) => {
    if (k.batch_id) acc[k.batch_id] = (acc[k.batch_id] ?? 0) + 1
    return acc
  }, {})

  const sentCount   = batches?.filter(b => b.status === 'sent').length ?? 0
  const doneCount   = batches?.filter(b => b.status === 'results_received').length ?? 0

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Batches NH</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Groepeer retour-testkits en verstuur ze naar Nightingale Health
          </p>
        </div>
        <Link
          href="/batches/nieuw"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
        >
          <Plus size={15} />
          Nieuwe batch
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TestTube2 size={15} className="text-purple-500" />
            <span className="text-xs font-medium text-[#64748b]">Wacht op batch</span>
          </div>
          <p className="text-2xl font-bold text-[#1e293b]">{retourCount ?? 0}</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">testkits met status Retour</p>
          {(retourCount ?? 0) > 0 && (
            <Link href="/batches/nieuw" className="text-xs text-[#1f1683] hover:underline mt-1 inline-block">
              Batch aanmaken →
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={15} className="text-cyan-500" />
            <span className="text-xs font-medium text-[#64748b]">Wacht op resultaten</span>
          </div>
          <p className="text-2xl font-bold text-[#1e293b]">{sentCount}</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">batches verzonden naar NH</p>
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={15} className="text-green-500" />
            <span className="text-xs font-medium text-[#64748b]">Resultaten ontvangen</span>
          </div>
          <p className="text-2xl font-bold text-[#1e293b]">{doneCount}</p>
          <p className="text-xs text-[#94a3b8] mt-0.5">batches afgerond</p>
        </div>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {!batches || batches.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Package size={32} className="text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#94a3b8]">Nog geen batches aangemaakt</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              Zodra testkits retour zijn, kun je ze groeperen en versturen.
            </p>
            {(retourCount ?? 0) > 0 && (
              <Link
                href="/batches/nieuw"
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors mt-4"
              >
                <Plus size={15} />
                Nieuwe batch aanmaken
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Badge ID</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Verzenddatum</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Kits</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Resultaten</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {batches.map((batch) => (
                <ClickableRow key={batch.id} href={`/batches/${batch.id}`} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-[#1e293b]">{batch.badge_id}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(batch.sent_date)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{countByBatch[batch.id] ?? 0}</td>
                  <td className="px-4 py-3">
                    {batch.status === 'results_received' ? (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 border-green-200">
                        Resultaten ontvangen
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-700 border-cyan-200">
                        Verzonden naar NH
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">
                    {batch.results_date ? formatDate(batch.results_date) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
