'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Pencil, KeyRound, PauseCircle, PlayCircle, Trash2, Check, X, Loader2, AlertTriangle,
} from 'lucide-react'

export interface MedewerkerRow {
  id:     string
  name:   string
  role:   string
  userId: string
  email:  string
  onHold: boolean
  isSelf: boolean
}

const ROLES = [
  { value: 'medewerker',    label: 'Medewerker' },
  { value: 'arts',          label: 'Arts' },
  { value: 'leefstijlarts', label: 'Leefstijlarts' },
  { value: 'admin',         label: 'Beheerder' },
]
const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map(r => [r.value, r.label]))

type ConfirmType = 'reset' | 'hold' | 'unhold' | 'delete'

export function MedewerkersTable({ medewerkers }: { medewerkers: MedewerkerRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(medewerkers)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirm, setConfirm] = useState<{ row: MedewerkerRow; type: ConfirmType } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function flash(msg: string) { setNotice(msg); setTimeout(() => setNotice(''), 4000) }

  async function saveName(row: MedewerkerRow) {
    const name = editName.trim()
    if (!name) return
    setBusyId(row.id); setError('')
    const res = await fetch(`/api/admin/medewerkers/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setBusyId(null)
    if (!res.ok) { setError((await res.json()).error ?? 'Opslaan mislukt.'); return }
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, name } : r))
    setEditId(null)
    flash('Gegevens bijgewerkt.')
  }

  async function changeRole(row: MedewerkerRow, role: string) {
    if (role === row.role) return
    setBusyId(row.id); setError('')
    const res = await fetch(`/api/admin/medewerkers/${row.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    setBusyId(null)
    if (!res.ok) { setError((await res.json()).error ?? 'Rol wijzigen mislukt.'); return }
    setRows(rs => rs.map(r => r.id === row.id ? { ...r, role } : r))
    flash(`Rol gewijzigd naar ${ROLE_LABEL[role]}.`)
  }

  async function runConfirm() {
    if (!confirm) return
    const { row, type } = confirm
    setBusyId(row.id); setError('')
    let res: Response
    if (type === 'reset') {
      res = await fetch(`/api/admin/medewerkers/${row.id}/reset-password`, { method: 'POST' })
    } else if (type === 'delete') {
      res = await fetch(`/api/admin/medewerkers/${row.id}`, { method: 'DELETE' })
    } else {
      res = await fetch(`/api/admin/medewerkers/${row.id}/ban`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold: type === 'hold' }),
      })
    }
    setBusyId(null)
    setConfirm(null)
    if (!res.ok) { setError((await res.json()).error ?? 'Actie mislukt.'); return }

    if (type === 'delete') {
      setRows(rs => rs.filter(r => r.id !== row.id))
      flash('Medewerker verwijderd.')
    } else if (type === 'reset') {
      flash(`Herstelmail verstuurd naar ${row.email}.`)
    } else {
      const hold = type === 'hold'
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, onHold: hold } : r))
      flash(hold ? 'Medewerker op on hold gezet.' : 'Medewerker weer geactiveerd.')
    }
    router.refresh()
  }

  const confirmText: Record<ConfirmType, (r: MedewerkerRow) => string> = {
    reset:  r => `Een wachtwoord-herstelmail sturen naar ${r.name} (${r.email})?`,
    hold:   r => `${r.name} op on hold zetten? Deze persoon kan dan niet meer inloggen.`,
    unhold: r => `${r.name} weer activeren zodat inloggen weer mogelijk is?`,
    delete: r => `${r.name} definitief verwijderen? Dit account en de toegang worden verwijderd. Dit kan niet ongedaan worden gemaakt.`,
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#f1f5f9] bg-[#f8fafc] flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#475569]">Medewerkers ({rows.length})</h2>
      </div>

      {(error || notice) && (
        <div className={`px-5 py-2.5 text-sm border-b ${error ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <div className="divide-y divide-[#f1f5f9]">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#94a3b8]">Geen medewerkers gevonden.</p>
        ) : rows.map(row => (
          <div key={row.id} className="px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Identiteit */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-9 w-9 rounded-full bg-[#eef4ff] flex items-center justify-center shrink-0">
                <span className="text-xs font-semibold text-[#1f1683]">
                  {row.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                {editId === row.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="rounded-md border border-[#e2e8f0] px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20"
                      autoFocus
                    />
                    <button onClick={() => saveName(row)} disabled={busyId === row.id} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                      <Check size={15} />
                    </button>
                    <button onClick={() => setEditId(null)} className="p-1 text-[#94a3b8] hover:bg-[#f8fafc] rounded">
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm font-medium text-[#1e293b] truncate flex items-center gap-1.5">
                    {row.name}
                    {row.isSelf && <span className="text-[10px] font-normal text-[#94a3b8]">(jij)</span>}
                  </p>
                )}
                <p className="text-xs text-[#94a3b8] truncate">{row.email || '—'}</p>
              </div>
            </div>

            {/* Status */}
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              row.onHold ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {row.onHold ? 'On hold' : 'Actief'}
            </span>

            {/* Rol */}
            <select
              value={row.role}
              onChange={e => changeRole(row, e.target.value)}
              disabled={busyId === row.id || (row.isSelf && row.role === 'admin')}
              title={row.isSelf && row.role === 'admin' ? 'Je kunt je eigen beheerdersrol niet verlagen' : 'Rol aanpassen'}
              className="shrink-0 rounded-lg border border-[#e2e8f0] bg-white px-2 py-1.5 text-xs text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 disabled:opacity-60"
            >
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            {/* Acties */}
            <div className="flex items-center gap-1 shrink-0">
              <IconBtn title="Naam aanpassen" onClick={() => { setEditId(row.id); setEditName(row.name) }}>
                <Pencil size={15} />
              </IconBtn>
              <IconBtn title="Wachtwoord resetten" onClick={() => setConfirm({ row, type: 'reset' })}>
                <KeyRound size={15} />
              </IconBtn>
              {!row.isSelf && (
                row.onHold ? (
                  <IconBtn title="Activeren" onClick={() => setConfirm({ row, type: 'unhold' })} className="text-emerald-600 hover:bg-emerald-50">
                    <PlayCircle size={15} />
                  </IconBtn>
                ) : (
                  <IconBtn title="On hold zetten" onClick={() => setConfirm({ row, type: 'hold' })} className="text-orange-600 hover:bg-orange-50">
                    <PauseCircle size={15} />
                  </IconBtn>
                )
              )}
              {!row.isSelf && (
                <IconBtn title="Verwijderen" onClick={() => setConfirm({ row, type: 'delete' })} className="text-red-500 hover:bg-red-50">
                  {busyId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </IconBtn>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bevestigingsdialoog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${confirm.type === 'delete' ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle size={18} className={confirm.type === 'delete' ? 'text-red-600' : 'text-amber-600'} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#1e293b] mb-1">Weet je het zeker?</p>
                <p className="text-sm text-[#64748b]">{confirmText[confirm.type](confirm.row)}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#64748b] hover:bg-[#f8fafc]">
                Annuleren
              </button>
              <button
                onClick={runConfirm}
                disabled={busyId === confirm.row.id}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirm.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1f1683] hover:bg-[#1a1270]'
                }`}
              >
                {busyId === confirm.row.id && <Loader2 size={14} className="animate-spin" />}
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, onClick, title, className = '' }: {
  children: React.ReactNode; onClick: () => void; title: string; className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f8fafc] transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
