'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, CheckCircle2, Clock, Loader2, AlertTriangle } from 'lucide-react'

export interface Row {
  annotationId: string
  clientLabel:  string
  artsName:     string
  status:       string
  uploaded:     boolean
}

export function UploadTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [sel, setSel]   = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | 'bulk' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectable = rows.filter(r => !r.uploaded)

  function toggle(id: string) {
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setError(''); setNotice('')
  }
  function toggleAll() {
    setSel(prev => prev.size === selectable.length ? new Set() : new Set(selectable.map(r => r.annotationId)))
  }

  async function upload(ids: string[], marker: string | 'bulk') {
    if (ids.length === 0) { setError('Selecteer minstens één annotatie.'); return }
    setBusy(marker); setError(''); setNotice('')
    const res = await fetch('/api/annotatie/naar-training', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotationIds: ids }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(j.error ?? 'Uploaden mislukt.'); return }
    setSel(new Set())
    setNotice(`${j.uploaded} toegevoegd${j.skipped ? `, ${j.skipped} overgeslagen` : ''}${j.failed ? `, ${j.failed} mislukt` : ''}.`)
    router.refresh()
  }

  if (rows.length === 0) {
    return <div className="rounded-xl border border-[#e2e8f0] bg-white p-10 text-center text-sm text-[#94a3b8] shadow-sm">Nog geen annotaties in deze ronde.</div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#64748b]">{sel.size} geselecteerd</span>
        <button onClick={() => upload([...sel], 'bulk')} disabled={busy !== null || sel.size === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] disabled:opacity-50">
          {busy === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <GraduationCap size={15} />} Upload geselecteerde
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" /><p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" /><p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="w-10 px-4 py-3">
                <input type="checkbox" className="h-4 w-4 accent-[#1f1683]"
                  checked={selectable.length > 0 && sel.size === selectable.length} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Dossier</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Arts</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Training</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {rows.map(r => (
              <tr key={r.annotationId} className="hover:bg-[#f8fafc]">
                <td className="px-4 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-[#1f1683] disabled:opacity-40"
                    disabled={r.uploaded} checked={sel.has(r.annotationId)} onChange={() => toggle(r.annotationId)} />
                </td>
                <td className="px-4 py-3 font-medium text-[#1e293b]">{r.clientLabel}</td>
                <td className="px-4 py-3 text-[#334155]">{r.artsName}</td>
                <td className="px-4 py-3">
                  {r.status === 'ingediend' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700"><CheckCircle2 size={11} /> Ingediend</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"><Clock size={11} /> Concept</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.uploaded
                    ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0d7a5f]"><GraduationCap size={12} /> Geüpload</span>
                    : <span className="text-xs text-[#cbd5e1]">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {!r.uploaded && (
                    <button onClick={() => upload([r.annotationId], r.annotationId)} disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc] disabled:opacity-50">
                      {busy === r.annotationId ? <Loader2 size={12} className="animate-spin" /> : <GraduationCap size={12} />} Upload
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
