'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { nl } from 'date-fns/locale'
import { Loader2, Filter } from 'lucide-react'
import {
  ACTION_META, ROLE_BADGE, roleFitsAction,
  type ActionType, type RequiredRole,
} from '@/lib/actions'

interface ActionRow {
  key: string
  actionType: ActionType
  subjectId: string
  subjectLabel: string
  subjectSub: string | null
  href: string
  date: string
}

interface Member { id: string; name: string; role: string }

interface Props {
  actions:         ActionRow[]
  members:         Member[]
  assignments:     Record<string, { memberId: string; memberName: string }>
  currentMemberId: string | null
}

export function ActionsTable({ actions, members, assignments: initialAssignments, currentMemberId }: Props) {
  const router = useRouter()
  const [assignments, setAssignments] = useState(initialAssignments)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Filters
  const [fType, setFType] = useState<'all' | ActionType>('all')
  const [fRole, setFRole] = useState<'all' | RequiredRole>('all')
  const [fAssign, setFAssign] = useState<'all' | 'unassigned' | 'mine'>('all')

  const filtered = useMemo(() => {
    return actions.filter(a => {
      if (fType !== 'all' && a.actionType !== fType) return false
      const meta = ACTION_META[a.actionType]
      if (fRole !== 'all' && meta.requiredRole !== fRole) return false
      const assigned = assignments[a.key]
      if (fAssign === 'unassigned' && assigned) return false
      if (fAssign === 'mine' && (!assigned || assigned.memberId !== currentMemberId)) return false
      return true
    })
  }, [actions, assignments, fType, fRole, fAssign, currentMemberId])

  async function assign(row: ActionRow, memberId: string | null) {
    setSavingKey(row.key)
    setError('')
    const res = await fetch('/api/actions/assign', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ actionType: row.actionType, subjectId: row.subjectId, assignedTo: memberId }),
    })
    const json = await res.json()
    setSavingKey(null)
    if (!res.ok) { setError(json.error ?? 'Toewijzen mislukt.'); return }

    setAssignments(prev => {
      const next = { ...prev }
      if (memberId === null) {
        delete next[row.key]
      } else {
        next[row.key] = { memberId, memberName: json.assigneeName ?? '—' }
      }
      return next
    })
  }

  const selectCls = 'rounded-lg border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20'

  return (
    <div className="space-y-3">
      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#64748b]">
          <Filter size={13} /> Filter:
        </span>
        <select value={fType} onChange={e => setFType(e.target.value as typeof fType)} className={selectCls}>
          <option value="all">Alle acties</option>
          {(Object.keys(ACTION_META) as ActionType[]).map(t => (
            <option key={t} value={t}>{ACTION_META[t].label}</option>
          ))}
        </select>
        <select value={fRole} onChange={e => setFRole(e.target.value as typeof fRole)} className={selectCls}>
          <option value="all">Alle rollen</option>
          <option value="arts">Arts</option>
          <option value="medewerker">Medewerker</option>
        </select>
        <select value={fAssign} onChange={e => setFAssign(e.target.value as typeof fAssign)} className={selectCls}>
          <option value="all">Alle toewijzingen</option>
          <option value="unassigned">Niet toegewezen</option>
          {currentMemberId && <option value="mine">Aan mij toegewezen</option>}
        </select>
        <span className="text-xs text-[#94a3b8] ml-auto">{filtered.length} van {actions.length}</span>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* ── Tabel ── */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Actie</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Onderwerp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Wanneer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#64748b] uppercase tracking-wide">Toegewezen aan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#94a3b8]">
                    Geen openstaande acties.
                  </td>
                </tr>
              ) : filtered.map(row => {
                const meta = ACTION_META[row.actionType]
                const badge = ROLE_BADGE[meta.requiredRole]
                const assigned = assignments[row.key]
                // Medewerkers die deze actie mogen oppakken
                const eligible = members.filter(m => roleFitsAction(m.role, meta.requiredRole))
                const ago = formatDistanceToNow(new Date(row.date), { locale: nl, addSuffix: true })

                return (
                  <tr
                    key={row.key}
                    onClick={() => router.push(row.href)}
                    className="hover:bg-[#f8fafc] cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-[#1e293b] whitespace-nowrap">{meta.label}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium text-[#1e293b] ${meta.subject === 'kit' ? 'font-mono' : ''}`}>
                        {row.subjectLabel}
                      </span>
                      {row.subjectSub && <p className="text-xs text-[#94a3b8]">{row.subjectSub}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#94a3b8] whitespace-nowrap">{ago}</td>
                    {/* Toewijzen — klik hier navigeert niet naar de pagina */}
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <select
                          value={assigned?.memberId ?? ''}
                          disabled={savingKey === row.key}
                          onChange={e => assign(row, e.target.value || null)}
                          className={`${selectCls} min-w-[160px] ${assigned ? 'border-[#c7d7fd] bg-[#eef4ff] text-[#1f1683] font-medium' : 'text-[#64748b]'}`}
                        >
                          <option value="">— Niet toegewezen</option>
                          {eligible.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        {savingKey === row.key && <Loader2 size={14} className="animate-spin text-[#94a3b8]" />}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
