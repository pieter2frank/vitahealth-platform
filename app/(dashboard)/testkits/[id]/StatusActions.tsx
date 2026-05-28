'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PackageCheck, Send, FlaskConical, RotateCcw, Unlink, AlertTriangle } from 'lucide-react'
import type { TestkitStatus } from '@/types'

interface Props {
  kit: {
    id: string
    status: TestkitStatus
    badge_id: string | null
    assigned: boolean
  }
}

export function StatusActions({ kit }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [badgeId, setBadgeId] = useState(kit.badge_id ?? '')
  const [badgeDate, setBadgeDate] = useState(new Date().toISOString().split('T')[0])
  const [retourDate, setRetourDate] = useState(new Date().toISOString().split('T')[0])
  const [resultsDate, setResultsDate] = useState(new Date().toISOString().split('T')[0])

  async function update(payload: Record<string, unknown>) {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('vh_testkit').update(payload).eq('id', kit.id)
    if (err) { setError(err.message); setSaving(false); return }
    router.refresh()
    setSaving(false)
  }

  if (kit.status === 'results_available') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-5">
        <p className="text-sm font-medium text-green-700 flex items-center gap-2">
          <FlaskConical size={15} />
          Resultaten zijn beschikbaar — proces afgerond.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-[#1e293b]">Volgende actie</h2>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* assigned → retour */}
      {(kit.status === 'received' || kit.status === 'assigned') && (
        <div className="space-y-3">
          <p className="text-sm text-[#64748b]">
            Heeft de cliënt de testkit teruggestuurd?
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Retourdatum"
                type="date"
                value={retourDate}
                onChange={e => setRetourDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => update({ status: 'retour', retour_date: retourDate })}
              loading={saving}
              className="gap-2"
            >
              <PackageCheck size={15} />
              Retour ontvangen
            </Button>
          </div>
        </div>
      )}

      {/* retour → sent_nightingale */}
      {kit.status === 'retour' && (
        <div className="space-y-3">
          <p className="text-sm text-[#64748b]">
            Verstuur de kit naar Nightingale Health en registreer de batch.
          </p>
          <Input
            label="Badge ID"
            value={badgeId}
            onChange={e => setBadgeId(e.target.value)}
            placeholder="Bijv. NHG-2026-001"
            required
          />
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Verzenddatum"
                type="date"
                value={badgeDate}
                onChange={e => setBadgeDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => {
                if (!badgeId.trim()) { setError('Badge ID is verplicht.'); return }
                update({ status: 'sent_nightingale', badge_id: badgeId.trim(), badge_datesent: badgeDate })
              }}
              loading={saving}
              className="gap-2"
            >
              <Send size={15} />
              Verzonden naar NHG
            </Button>
          </div>
        </div>
      )}

      {/* sent_nightingale → results_available */}
      {kit.status === 'sent_nightingale' && (
        <div className="space-y-3">
          <p className="text-sm text-[#64748b]">
            Zijn de resultaten van Nightingale Health ontvangen?
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Datum resultaten"
                type="date"
                value={resultsDate}
                onChange={e => setResultsDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => update({ status: 'results_available', results_date: resultsDate })}
              loading={saving}
              variant="accent"
              className="gap-2"
            >
              <FlaskConical size={15} />
              Resultaten ontvangen
            </Button>
          </div>
        </div>
      )}

      {/* Ontkoppelen */}
      {kit.assigned && (
        <div className="border-t border-[#f1f5f9] pt-4">
          {!confirmUnlink ? (
            <button
              onClick={() => setConfirmUnlink(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-red-500 transition-colors"
            >
              <Unlink size={12} />
              Toewijzing ontkoppelen
            </button>
          ) : (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
              <p className="text-xs font-medium text-orange-700 flex items-center gap-1.5">
                <AlertTriangle size={13} />
                Weet je zeker dat je de toewijzing wilt verwijderen?
              </p>
              <p className="text-xs text-orange-600">
                De kit wordt losgekoppeld en de status wordt teruggezet naar "Ontvangen".
              </p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => update({
                    assigned: false,
                    assigned_client_id: null,
                    assigned_company_id: null,
                    assigned_arbo_id: null,
                    assigned_date: null,
                    status: 'received',
                  })}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 transition-colors"
                >
                  Ja, ontkoppelen
                </button>
                <button
                  onClick={() => setConfirmUnlink(false)}
                  className="rounded-md border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terugzetten */}
      {kit.status !== 'received' && (
        <div className={kit.assigned ? '' : 'border-t border-[#f1f5f9] pt-4'}>
          <button
            onClick={() => {
              const prev: Record<TestkitStatus, TestkitStatus> = {
                assigned: 'received',
                retour: 'assigned',
                sent_nightingale: 'retour',
                results_available: 'sent_nightingale',
                received: 'received',
              }
              update({ status: prev[kit.status] })
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#64748b] transition-colors mt-2"
          >
            <RotateCcw size={12} />
            Status terugzetten naar vorige stap
          </button>
        </div>
      )}
    </div>
  )
}
