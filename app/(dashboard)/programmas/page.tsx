import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import { Dumbbell, Plus, Users, Star, Clock } from 'lucide-react'
import { ClickableRow } from '@/components/ui/ClickableRow'

export default async function ProgrammasPage() {
  const supabase = await createClient()

  const { data: programs } = await supabase
    .from('vh_program')
    .select('id, slug, title, description, tags, is_premium, duration_days, status, created_at')
    .order('created_at', { ascending: false })

  const { data: assignments } = await supabase
    .from('vh_program_assignment')
    .select('program_id')

  const countByProgram: Record<string, number> = {}
  for (const a of assignments ?? []) {
    countByProgram[a.program_id] = (countByProgram[a.program_id] ?? 0) + 1
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Programma&apos;s</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            Beheer en wijs gezondheidsuitdagingen toe aan cliënten
          </p>
        </div>
        <Link
          href="/programmas/importeer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
        >
          <Plus size={15} />
          Programma importeren
        </Link>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {!programs || programs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Dumbbell size={32} className="text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-sm font-medium text-[#94a3b8]">Nog geen programma&apos;s</p>
            <p className="text-xs text-[#94a3b8] mt-1">Importeer een JSON-bestand om te beginnen.</p>
            <Link
              href="/programmas/importeer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors mt-4"
            >
              <Plus size={15} />
              Importeer eerste programma
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Titel</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Tags</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Duur</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toewijzingen</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegevoegd</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {programs.map((p) => (
                <ClickableRow key={p.id} href={`/programmas/${p.id}`} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#1e293b]">{p.title}</p>
                      {p.is_premium && (
                        <Star size={12} className="text-amber-400 shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] font-mono">{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.tags ?? []).map((tag: string) => (
                        <span key={tag} className="inline-flex items-center rounded-full bg-[#eef4ff] px-2 py-0.5 text-xs text-[#1f1683]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.duration_days ? (
                      <span className="inline-flex items-center gap-1 text-[#64748b]">
                        <Clock size={12} />
                        {p.duration_days} dagen
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {countByProgram[p.id] ? (
                      <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                        <Users size={13} />
                        {countByProgram[p.id]}
                      </span>
                    ) : (
                      <span className="text-[#94a3b8]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(p.created_at)}</td>
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
