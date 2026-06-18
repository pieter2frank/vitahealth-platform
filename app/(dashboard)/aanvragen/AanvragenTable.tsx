'use client'
import { useState, useMemo } from 'react'
import { formatDateTime } from '@/lib/utils'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { ENROLLMENT_LABELS, ENROLLMENT_COLORS, type EnrollmentStatus } from '@/lib/enrollment'
import { Clock, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface AanvraagRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  city: string | null
  enrollment_status: string
  created_at: string
}

type SortKey = 'name' | 'email' | 'city' | 'status' | 'created'

function nextActionFor(es: EnrollmentStatus): string {
  return es === 'aangemeld'            ? 'Wacht op toestemming' :
         es === 'toestemming_gegeven'  ? 'Wacht op vragenlijst' :
         es === 'vragenlijst_ingevuld' ? 'Wacht op arts ✓' :
         es === 'intake_akkoord'       ? 'Kit koppelen en opsturen' : ''
}

export function AanvragenTable({ clients }: { clients: AanvraagRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [dir, setDir]         = useState<'asc' | 'desc'>('desc')

  function toggleSort(k: SortKey) {
    if (sortKey === k) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setDir(k === 'created' ? 'desc' : 'asc') }
  }

  const rows = useMemo(() => {
    const val = (c: AanvraagRow) =>
      sortKey === 'name'   ? `${c.last_name} ${c.first_name}`.toLowerCase() :
      sortKey === 'email'  ? (c.email ?? '').toLowerCase() :
      sortKey === 'city'   ? (c.city ?? '').toLowerCase() :
      sortKey === 'status' ? (ENROLLMENT_LABELS[c.enrollment_status as EnrollmentStatus] ?? c.enrollment_status).toLowerCase() :
                             (c.created_at ?? '')
    return [...clients].sort((a, b) => {
      const av = val(a), bv = val(b)
      return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'asc' ? 1 : -1)
    })
  }, [clients, sortKey, dir])

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
            <SortHeader label="Naam"          k="name"    active={sortKey} dir={dir} onClick={toggleSort} />
            <SortHeader label="E-mail"        k="email"   active={sortKey} dir={dir} onClick={toggleSort} />
            <SortHeader label="Stad"          k="city"    active={sortKey} dir={dir} onClick={toggleSort} />
            <SortHeader label="Aanmeldstatus" k="status"  active={sortKey} dir={dir} onClick={toggleSort} />
            <SortHeader label="Aangemeld op"  k="created" active={sortKey} dir={dir} onClick={toggleSort} />
            <th className="px-4 py-3 text-left font-medium text-[#64748b]">Actie</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {rows.map((c) => {
            const es = c.enrollment_status as EnrollmentStatus
            const nextAction = nextActionFor(es)
            return (
              <ClickableRow key={c.id} href={`/clienten/${c.id}`} className="hover:bg-[#f8fafc] transition-colors">
                <td className="px-4 py-3 font-medium text-[#1e293b]">{c.first_name} {c.last_name}</td>
                <td className="px-4 py-3 text-[#64748b]">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-[#64748b]">{c.city ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${ENROLLMENT_COLORS[es] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                    {ENROLLMENT_LABELS[es] ?? es}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#64748b]">{formatDateTime(c.created_at)}</td>
                <td className="px-4 py-3">
                  {nextAction && (
                    <span className="inline-flex items-center gap-1 text-xs text-[#64748b]">
                      <Clock size={11} />
                      {nextAction}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
              </ClickableRow>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SortHeader({ label, k, active, dir, onClick }: {
  label: string; k: SortKey; active: SortKey; dir: 'asc' | 'desc'; onClick: (k: SortKey) => void
}) {
  const isActive = active === k
  return (
    <th className="px-4 py-3 text-left font-medium text-[#64748b]">
      <button type="button" onClick={() => onClick(k)} className="inline-flex items-center gap-1 hover:text-[#1f1683] transition-colors">
        {label}
        {isActive
          ? (dir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />)
          : <ChevronsUpDown size={13} className="text-[#cbd5e1]" />}
      </button>
    </th>
  )
}
