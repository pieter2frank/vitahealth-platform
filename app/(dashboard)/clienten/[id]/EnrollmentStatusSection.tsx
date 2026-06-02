'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'
import {
  ENROLLMENT_STATUSES, ENROLLMENT_LABELS, ENROLLMENT_COLORS,
  enrollmentStatusIndex, type EnrollmentStatus,
} from '@/lib/enrollment'
import { CheckCircle2, ChevronRight, Loader2, XCircle, AlertTriangle } from 'lucide-react'

// ─── Volgende status per stap (goedkeuringspad) ────────────────────────────────

interface Transition {
  label:    string
  next:     EnrollmentStatus
  artsOnly: boolean
}

const TRANSITIONS: Partial<Record<string, Transition>> = {
  vragenlijst_ingevuld: { label: 'Intake goedkeuren', next: 'intake_akkoord',   artsOnly: true  },
  intake_akkoord:       { label: 'Kit opgestuurd',    next: 'kit_opgestuurd',   artsOnly: false },
  kit_opgestuurd:       { label: 'Kit retour',        next: 'kit_retour',       artsOnly: false },
  kit_retour:           { label: 'Uitslag bekend',    next: 'uitslag_bekend',   artsOnly: true  },
  uitslag_bekend:       { label: 'Uitslag besproken', next: 'uitslag_besproken',artsOnly: true  },
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clientId:        string
  initialStatus:   string
  assignedKitId:   string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EnrollmentStatusSection({ clientId, initialStatus, assignedKitId }: Props) {
  const { role }  = useUser()
  const [status,  setStatus]  = useState(initialStatus)
  const [saving,  setSaving]  = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const [error,   setError]   = useState('')

  // ── Index voor de tijdlijn ──────────────────────────────────────────────────
  // intake_afgewezen zit niet in de hoofdlijn; toon de tijdlijn t/m vragenlijst_ingevuld
  const isRejected    = status === 'intake_afgewezen'
  const timelineIndex = isRejected
    ? enrollmentStatusIndex('vragenlijst_ingevuld')
    : enrollmentStatusIndex(status)

  const transition    = TRANSITIONS[status]
  const canTransition = !isRejected && transition && (!transition.artsOnly || canSeeResults(role))
  const canReject     = status === 'vragenlijst_ingevuld' && canSeeResults(role)

  // Mapping: welke cliëntstatus triggert welke testkit-update
  const KIT_SYNC: Partial<Record<EnrollmentStatus, { status: string; dateField: string }>> = {
    kit_opgestuurd: { status: 'kit_verstuurd',     dateField: 'kit_sent_date' },
    kit_retour:     { status: 'retour',            dateField: 'retour_date' },
    uitslag_bekend: { status: 'results_available', dateField: 'results_date' },
  }

  // ── Goedkeuren ──────────────────────────────────────────────────────────────
  async function advance() {
    if (!transition) return
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('vh_client')
      .update({ enrollment_status: transition.next })
      .eq('id', clientId)
    if (err) { setSaving(false); setError(err.message); return }

    // Synchroniseer testkit-status indien van toepassing
    const kitSync = KIT_SYNC[transition.next]
    if (kitSync && assignedKitId) {
      await supabase
        .from('vh_testkit')
        .update({ status: kitSync.status, [kitSync.dateField]: new Date().toISOString() })
        .eq('id', assignedKitId)
    }

    setSaving(false)
    setStatus(transition.next)
  }

  // ── Afwijzen ────────────────────────────────────────────────────────────────
  async function reject() {
    setRejecting(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase
      .from('vh_client')
      .update({ enrollment_status: 'intake_afgewezen' })
      .eq('id', clientId)
    setRejecting(false)
    if (err) { setError(err.message); return }
    setStatus('intake_afgewezen')
    setConfirmReject(false)
  }

  return (
    <div className="mb-5 rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-3.5">
        <h2 className="text-sm font-semibold text-[#1e293b]">Aanmeldstatus</h2>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ENROLLMENT_COLORS[status] ?? 'bg-slate-100 text-slate-700 border-slate-200'}`}>
          {ENROLLMENT_LABELS[status] ?? status}
        </span>
      </div>

      <div className="px-5 py-4">

        {/* ── Tijdlijn ─────────────────────────────────────────────────────── */}
        <div className="flex items-center">
          {ENROLLMENT_STATUSES.map((s, i) => {
            // Alle stappen t/m en inclusief timelineIndex zijn "bereikt"
            const reached    = i <= timelineIndex
            // De meest recente stap (timelineIndex) krijgt groen, tenzij afgewezen
            const isCurrent  = i === timelineIndex && !isRejected
            const isDone     = reached && !isCurrent  // blauw ✓ (eerder bereikt)
            const isFuture   = !reached               // grijs, nog niet bereikt
            // Lijn na stap i: blauw als beide uiteinden bereikt zijn
            const lineActive = i < timelineIndex

            return (
              <div key={s} className="flex items-center flex-1 min-w-0">
                {/* Cirkel + label */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center border-2 transition-colors text-[10px] font-bold ${
                    isCurrent ? 'bg-emerald-500 border-emerald-500 text-white' :
                    isDone    ? 'bg-[#1f1683] border-[#1f1683] text-white'    :
                                'bg-white border-[#e2e8f0] text-[#d1d5db]'
                  }`}>
                    {(isCurrent || isDone) ? <CheckCircle2 size={13} /> : i + 1}
                  </div>
                  <span className={`mt-1 text-[9px] font-medium text-center leading-tight whitespace-nowrap ${
                    isCurrent ? 'text-emerald-600' :
                    isDone    ? 'text-[#1f1683]'   :
                                'text-[#cbd5e1]'
                  }`}>
                    {ENROLLMENT_LABELS[s]}
                  </span>
                </div>
                {/* Verbindingslijn */}
                {i < ENROLLMENT_STATUSES.length - 1 && (
                  <div className={`flex-1 h-0.5 mt-[-10px] mx-0.5 transition-colors ${
                    lineActive ? 'bg-[#1f1683]' : 'bg-[#e2e8f0]'
                  }`} />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Afgewezen-banner ─────────────────────────────────────────────── */}
        {isRejected && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <XCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Intake afgewezen</p>
              <p className="text-xs text-red-600 mt-0.5">
                De arts neemt contact op met de deelnemer over de reden en de vervolgstappen.
              </p>
            </div>
          </div>
        )}

        {/* ── Actieknoppen ─────────────────────────────────────────────────── */}
        {(canTransition || (canReject && !isRejected)) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">

            {/* Goedkeuren-knop */}
            {canTransition && !confirmReject && (
              <button
                onClick={advance}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Bezig…</>
                  : <><ChevronRight size={14} /> {transition!.label}</>
                }
              </button>
            )}

            {/* Afwijzen-sectie (alleen bij vragenlijst_ingevuld + arts) */}
            {canReject && !confirmReject && (
              <button
                onClick={() => setConfirmReject(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} />
                Intake afwijzen
              </button>
            )}

            {/* Bevestiging afwijzen */}
            {confirmReject && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <span className="text-sm text-red-700">Intake afwijzen?</span>
                <button
                  onClick={reject}
                  disabled={rejecting}
                  className="text-sm font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
                >
                  {rejecting ? 'Bezig…' : 'Ja, afwijzen'}
                </button>
                <button
                  onClick={() => setConfirmReject(false)}
                  className="text-sm text-[#64748b] hover:text-[#1e293b]"
                >
                  Annuleren
                </button>
              </div>
            )}

            {error && <p className="text-xs text-red-600 w-full">{error}</p>}
          </div>
        )}

        {/* ── Klaar-melding ────────────────────────────────────────────────── */}
        {status === 'uitslag_besproken' && (
          <div className="mt-4 inline-flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={15} className="text-green-500" />
            Traject volledig afgerond.
          </div>
        )}

      </div>
    </div>
  )
}
