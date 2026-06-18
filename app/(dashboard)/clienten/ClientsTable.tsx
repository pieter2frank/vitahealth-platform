'use client'
import { useState, useMemo } from 'react'
import { formatDate } from '@/lib/utils'
import { ClickableRow } from '@/components/ui/ClickableRow'
import { ENROLLMENT_LABELS, ENROLLMENT_COLORS, type EnrollmentStatus } from '@/lib/enrollment'
import { ChevronUp, ChevronDown, ChevronsUpDown, ListFilter } from 'lucide-react'

export interface ClientRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  city: string | null
  created_at: string
  enrollment_status: string | null
}

type SortKey = 'name' | 'email' | 'city' | 'status' | 'created'

const STATUS_OPTIONS = Object.entries(ENROLLMENT_LABELS) as [string, string][]

export function ClientsTable({ clients, initialStatus }: { clients: ClientRow[]; initialStatus?: string }) {
  const [status, setStatus]   = useState(initialStatus ?? '')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [dir, setDir]         = useState<'asc' | 'desc'>('asc')

  function toggleSort(k: SortKey) {
    if (sortKey === k) setDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setDir('asc') }
  }

  const rows = useMemo(() => {
    const filtered = status ? clients.filter(c => c.enrollment_status === status) : clients
    const val = (c: ClientRow) =>
      sortKey === 'name'   ? `${c.last_name} ${c.first_name}`.toLowerCase() :
      sortKey === 'email'  ? (c.email ?? '').toLowerCase() :
      sortKey === 'city'   ? (c.city ?? '').toLowerCase() :
      sortKey === 'status' ? (ENROLLMENT_LABELS[c.enrollment_status as EnrollmentStatus] ?? c.enrollment_status ?? '').toLowerCase() :
                             (c.created_at ?? '')
    return [...filtered].sort((a, b) => {
      const av = val(a), bv = val(b)
      return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'asc' ? 1 : -1)
    })
  }, [clients, status, sortKey, dir])

  return (
    <>
      {/* Statusfilter */}
      <div className="mb-4 flex items-center gap-2">
        <ListFilter size={15} className="text-[#94a3b8]" />
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="h-9 rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
        >
          <option value="">Alle statussen</option>
          {STATUS_OPTIONS.map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <span className="text-xs text-[#94a3b8]">{rows.length} cliënt{rows.length !== 1 ? 'en' : ''}</span>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[#94a3b8]">
            Geen cliënten gevonden{status ? ` met status "${ENROLLMENT_LABELS[status as EnrollmentStatus] ?? status}"` : ''}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <SortHeader label="Naam"       k="name"    active={sortKey} dir={dir} onClick={toggleSort} />
                <SortHeader label="E-mail"     k="email"   active={sortKey} dir={dir} onClick={toggleSort} />
                <SortHeader label="Stad"       k="city"    active={sortKey} dir={dir} onClick={toggleSort} />
                <SortHeader label="Status"     k="status"  active={sortKey} dir={dir} onClick={toggleSort} />
                <SortHeader label="Aangemaakt" k="created" active={sortKey} dir={dir} onClick={toggleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {rows.map((c) => (
                <ClickableRow key={c.id} href={`/clienten/${c.id}`} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-medium text-[#1e293b]">{c.first_name} {c.last_name}</td>
                  <td className="px-4 py-3 text-[#64748b]">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-[#64748b]">{c.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.enrollment_status && (
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${ENROLLMENT_COLORS[c.enrollment_status as EnrollmentStatus] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        {ENROLLMENT_LABELS[c.enrollment_status as EnrollmentStatus] ?? c.enrollment_status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-right text-[#94a3b8] text-xs">→</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
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
