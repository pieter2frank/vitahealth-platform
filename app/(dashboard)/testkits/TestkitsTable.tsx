'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  received:         { label: 'Ontvangen',           cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  assigned:         { label: 'Toegewezen',           cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  kit_verstuurd:    { label: 'Verstuurd naar cliënt',cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  retour:           { label: 'Retour',               cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  sent_nightingale: { label: 'Verzonden NHG',        cls: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  results_available:{ label: 'Resultaten',           cls: 'bg-green-100 text-green-700 border-green-200' },
}

export interface KitRow {
  id:         string
  barcode:    string
  date:       string
  status:     string
  assigned:   boolean
  assignedTo: string
}

interface Props {
  kits: KitRow[]
}

export function TestkitsTable({ kits }: Props) {
  const router = useRouter()
  const [selected,  setSelected]  = useState<Set<string>>(new Set())
  const [deleting,  setDeleting]  = useState(false)
  const [confirm,   setConfirm]   = useState(false)
  const [error,     setError]     = useState('')

  const allChecked  = kits.length > 0 && selected.size === kits.length
  const someChecked = selected.size > 0

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(kits.map(k => k.id)))
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deleteSelected() {
    setDeleting(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('vh_testkit')
      .delete()
      .in('id', [...selected])

    if (err) { setError(err.message); setDeleting(false); setConfirm(false); return }

    setSelected(new Set())
    setConfirm(false)
    setDeleting(false)
    router.refresh()
  }

  if (kits.length === 0) return null

  return (
    <div>
      {/* ── Bulkactiebalk ───────────────────────────────────────────────── */}
      {someChecked && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#eef4ff] border-b border-[#c7d9ff]">
          <span className="text-sm font-medium text-[#1f1683]">
            {selected.size} testkit{selected.size !== 1 ? 's' : ''} geselecteerd
          </span>

          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
              Verwijder geselecteerde
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-red-700 font-medium">
                <AlertTriangle size={13} />
                Definitief verwijderen?
              </span>
              <button
                onClick={deleteSelected}
                disabled={deleting}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? <Loader2 size={12} className="animate-spin" /> : null}
                Ja, verwijderen
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
              >
                Annuleren
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{error}</p>
      )}

      {/* ── Tabel ───────────────────────────────────────────────────────── */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
            <th className="px-4 py-3 w-10">
              <input
                type="checkbox"
                checked={allChecked}
                ref={el => { if (el) el.indeterminate = someChecked && !allChecked }}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-[#d1d5db] accent-[#1f1683] cursor-pointer"
              />
            </th>
            <th className="px-4 py-3 text-left font-medium text-[#64748b]">Barcode</th>
            <th className="px-4 py-3 text-left font-medium text-[#64748b]">Datum inscan</th>
            <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegewezen aan</th>
            <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f5f9]">
          {kits.map((kit) => {
            const s       = STATUS_MAP[kit.status] ?? { label: kit.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
            const checked = selected.has(kit.id)

            return (
              <tr
                key={kit.id}
                className={`transition-colors ${checked ? 'bg-[#f5f7ff]' : 'hover:bg-[#f8fafc]'}`}
              >
                <td
                  className="px-4 py-3 w-10"
                  onClick={e => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOne(kit.id)}
                    className="h-4 w-4 rounded border-[#d1d5db] accent-[#1f1683] cursor-pointer"
                  />
                </td>
                <td className="px-4 py-3 font-mono font-medium text-[#1e293b]">{kit.barcode}</td>
                <td className="px-4 py-3 text-[#64748b]">{formatDateTime(kit.date)}</td>
                <td className="px-4 py-3 text-[#64748b]">{kit.assignedTo}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
                    {s.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/testkits/${kit.id}`}
                    className="text-xs text-[#1f1683] hover:underline"
                    onClick={e => e.stopPropagation()}
                  >
                    Details →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
