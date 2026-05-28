'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScrollText, Plus, CheckCircle2, Clock, Link2, Check, ExternalLink, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { ResultsModal } from './ResultsModal'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'

interface Assignment {
  id: string
  questionnaire_id: string
  questionnaire_title: string
  status: string
  assigned_at: string
}

interface Questionnaire {
  id: string
  title: string
}

interface Props {
  clientId: string
  initialAssignments: Assignment[]
  questionnaires: Questionnaire[]
  portalUrl: string
}

export function ClientQuestionnaireSection({ clientId, initialAssignments, questionnaires, portalUrl }: Props) {
  const router = useRouter()
  const { role } = useUser()
  const [showForm, setShowForm] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)   // assignment id that was just copied

  function getClientLink(assignmentId: string) {
    return `${portalUrl}/vragenlijsten/${assignmentId}`
  }

  async function copyLink(assignmentId: string) {
    try {
      await navigator.clipboard.writeText(getClientLink(assignmentId))
      setCopied(assignmentId)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback: select text
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) { setError('Kies een vragenlijst.'); return }

    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: dbErr } = await supabase
      .from('vh_questionnaire_assignment')
      .insert({ questionnaire_id: selectedId, client_id: clientId })

    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }

    setSelectedId('')
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  const pendingCount = initialAssignments.filter(a => a.status === 'pending').length

  return (
    <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
          <ScrollText size={15} className="text-[#94a3b8]" />
          Vragenlijsten ({initialAssignments.length})
          {pendingCount > 0 && (
            <span className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 border-orange-200">
              {pendingCount} open
            </span>
          )}
        </h2>
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          className="inline-flex items-center gap-1.5 text-xs text-[#1f1683] hover:underline"
        >
          {showForm ? <><X size={12} /> Sluiten</> : <><Plus size={12} /> Toewijzen</>}
        </button>
      </div>

      {/* Toewijzingsformulier */}
      {showForm && (
        <div className="border-b border-[#e2e8f0] bg-[#f8fafc] px-5 py-4">
          <form onSubmit={handleAssign} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#64748b] mb-1">Vragenlijst</label>
              <select
                value={selectedId}
                onChange={e => { setSelectedId(e.target.value); setError('') }}
                className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
              >
                <option value="">— Kies een vragenlijst —</option>
                {questionnaires.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saving || !selectedId}
              className="h-9 rounded-lg bg-[#1f1683] px-4 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {saving ? 'Bezig…' : 'Toewijzen'}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          {questionnaires.length === 0 && (
            <p className="mt-2 text-xs text-[#94a3b8]">
              Nog geen vragenlijsten beschikbaar.{' '}
              <Link href="/vragenlijsten/importeer" className="text-[#1f1683] hover:underline">
                Importeer er een →
              </Link>
            </p>
          )}
        </div>
      )}

      {/* Toewijzingen lijst */}
      {initialAssignments.length === 0 ? (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-[#94a3b8]">Nog geen vragenlijsten toegewezen.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-2 text-xs text-[#1f1683] hover:underline"
          >
            + Eerste vragenlijst toewijzen
          </button>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Vragenlijst</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Toegewezen</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[#64748b]">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {initialAssignments.map((a) => {
              const isDone = a.status === 'completed'
              const isCopied = copied === a.id
              return (
                <tr key={a.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/vragenlijsten/${a.questionnaire_id}`}
                      className="font-medium text-[#1e293b] hover:text-[#1f1683] hover:underline"
                    >
                      {a.questionnaire_title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(a.assigned_at)}</td>
                  <td className="px-4 py-3">
                    {isDone ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                        <CheckCircle2 size={11} /> Ingevuld
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5">
                        <Clock size={11} /> Open
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Invullen in dashboard */}
                      {!isDone && (
                        <Link
                          href={`/vragenlijsten/${a.questionnaire_id}/invullen/${a.id}`}
                          className="inline-flex items-center gap-1 text-xs text-[#1f1683] hover:underline"
                        >
                          <ExternalLink size={11} />
                          Invullen
                        </Link>
                      )}
                      {/* Resultaten bekijken — alleen voor arts/leefstijlarts */}
                      {isDone && canSeeResults(role) && (
                        <ResultsModal
                          questionnaireId={a.questionnaire_id}
                          questionnaireTitle={a.questionnaire_title}
                          clientId={clientId}
                        />
                      )}
                      {/* Kopieer cliëntlink */}
                      <button
                        type="button"
                        onClick={() => copyLink(a.id)}
                        className={`inline-flex items-center gap-1 text-xs transition-colors ${
                          isCopied
                            ? 'text-green-600'
                            : 'text-[#64748b] hover:text-[#1f1683]'
                        }`}
                        title={getClientLink(a.id)}
                      >
                        {isCopied ? <><Check size={11} /> Gekopieerd!</> : <><Link2 size={11} /> Link kopiëren</>}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
