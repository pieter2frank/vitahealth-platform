import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft, Dumbbell, Star, Clock, Tag, Users,
  CalendarDays, ChevronDown, CheckCircle2, Circle,
} from 'lucide-react'
import { AssignProgramForm } from './AssignProgramForm'
import { DeleteButton } from '@/components/ui/DeleteButton'
import type { ProgramDefinition } from '@/types'

export default async function ProgrammaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: p } = await supabase
    .from('vh_program')
    .select('*')
    .eq('id', id)
    .single()

  if (!p) notFound()

  const [{ data: assignments }, { data: clients }] = await Promise.all([
    supabase
      .from('vh_program_assignment')
      .select('id, status, start_date, assigned_at, vh_client(id, first_name, last_name)')
      .eq('program_id', id)
      .order('assigned_at', { ascending: false }),
    supabase
      .from('vh_client')
      .select('id, first_name, last_name')
      .order('last_name'),
  ])

  const def = p.json_content as ProgramDefinition
  const schedule = def.schedule ?? []
  const clientList = (clients ?? []).map(c => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))

  const STATUS_LABELS: Record<string, string> = {
    active: 'Actief',
    completed: 'Afgerond',
    paused: 'Gepauzeerd',
  }
  const STATUS_COLORS: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700 border-blue-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    paused: 'bg-gray-100 text-gray-500 border-gray-200',
  }

  return (
    <div className="p-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/programmas" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar programma&apos;s
        </Link>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
              <Dumbbell size={20} className="text-[#1f1683]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#1e293b]">{p.title}</h1>
                {p.is_premium && (
                  <Star size={16} className="text-amber-400" fill="currentColor" />
                )}
              </div>
              <p className="text-sm text-[#64748b] mt-0.5 font-mono">{p.slug}</p>
            </div>
          </div>
          <DeleteButton
            table="vh_program"
            id={p.id}
            redirectTo="/programmas"
            entityLabel={p.title}
            blockedMessage={
              assignments && assignments.length > 0
                ? `Er zijn ${assignments.length} toewijzing(en) voor dit programma. Verwijder de toewijzingen eerst.`
                : undefined
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Schema */}
        <div className="lg:col-span-3 space-y-4">
          {/* Meta info */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
            {p.description && (
              <p className="text-sm text-[#64748b] mb-4 leading-relaxed">{p.description}</p>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              {p.duration_days && (
                <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                  <Clock size={14} />
                  {p.duration_days} dagen
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[#64748b]">
                <CalendarDays size={14} />
                {schedule.length} dag{schedule.length !== 1 ? 'en' : ''} gepland
              </span>
            </div>
            {(p.tags ?? []).length > 0 && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Tag size={13} className="text-[#94a3b8]" />
                {(p.tags as string[]).map(tag => (
                  <span key={tag} className="inline-flex items-center rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-xs text-[#1f1683]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Dagschema */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-3">
              <h2 className="text-sm font-semibold text-[#1e293b]">Dagschema</h2>
            </div>
            <div className="divide-y divide-[#f1f5f9]">
              {schedule.map((day) => (
                <div key={day.day_index} className="px-5 py-3 flex items-start gap-3">
                  <div className="h-7 w-7 rounded-full bg-[#eef4ff] flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-[#1f1683]">{day.day_index}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1e293b]">{day.title}</p>
                    {day.description && (
                      <p className="text-xs text-[#64748b] mt-0.5">{day.description}</p>
                    )}
                    {day.content_blocks?.length > 0 && (
                      <p className="text-xs text-[#94a3b8] mt-1">
                        {day.content_blocks.length} content-blok{day.content_blocks.length !== 1 ? 'ken' : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rechterkolom */}
        <div className="lg:col-span-2 space-y-4">
          <AssignProgramForm programId={p.id} clients={clientList} />

          {/* Toewijzingen */}
          <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#e2e8f0] px-4 py-3 bg-[#f8fafc]">
              <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
                <Users size={14} className="text-[#94a3b8]" />
                Toewijzingen ({assignments?.length ?? 0})
              </h2>
            </div>
            {!assignments || assignments.length === 0 ? (
              <p className="px-4 py-5 text-sm text-[#94a3b8] text-center">
                Nog niet toegewezen aan cliënten.
              </p>
            ) : (
              <ul className="divide-y divide-[#f1f5f9]">
                {assignments.map((a) => {
                  const client = a.vh_client as unknown as { id: string; first_name: string; last_name: string } | null
                  return (
                    <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          href={client ? `/clienten/${client.id}` : '#'}
                          className="text-sm font-medium text-[#1f1683] hover:underline truncate block"
                        >
                          {client ? `${client.first_name} ${client.last_name}` : '—'}
                        </Link>
                        <p className="text-xs text-[#94a3b8]">{formatDate(a.assigned_at)}</p>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_COLORS[a.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {STATUS_LABELS[a.status] ?? a.status}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
