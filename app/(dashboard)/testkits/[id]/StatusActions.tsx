'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PackageCheck, Send, FlaskConical, RotateCcw, Unlink, AlertTriangle, Printer, Truck, Undo2 } from 'lucide-react'
import type { TestkitStatus } from '@/types'

// ─── Verzendlabel printen ─────────────────────────────────────────────────────

interface ClientAddress {
  firstName:  string
  lastName:   string
  address:    string | null
  postalCode: string | null
  city:       string | null
}

function printLabel(client: ClientAddress, barcode: string) {
  const w = window.open('', '_blank', 'width=500,height=420')
  if (!w) { alert('Pop-up geblokkeerd. Sta pop-ups toe voor dit venster.'); return }
  w.document.write(`<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <title>Verzendlabel — ${barcode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #fff; padding: 24px; }
    .label {
      border: 2px solid #000;
      border-radius: 6px;
      padding: 20px 24px;
      width: 340px;
      page-break-inside: avoid;
    }
    .from {
      font-size: 10px;
      color: #555;
      border-bottom: 1px solid #ccc;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .from strong { display: block; font-size: 11px; color: #000; margin-bottom: 2px; }
    .to-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .to-name  { font-size: 16px; font-weight: bold; color: #000; margin-bottom: 4px; }
    .to-addr  { font-size: 13px; color: #222; line-height: 1.5; }
    .barcode  {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #ccc;
      font-family: monospace;
      font-size: 13px;
      color: #333;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .barcode span { font-weight: bold; letter-spacing: .05em; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="label">
    <div class="from">
      <strong>Vita Health</strong>
      Afzender: Vita Health · info@vita-health.nl
    </div>
    <div class="to-label">Aan:</div>
    <div class="to-name">${client.firstName} ${client.lastName}</div>
    <div class="to-addr">
      ${client.address ?? '—'}<br>
      ${client.postalCode ?? ''} ${client.city ?? ''}
    </div>
    <div class="barcode">
      Kit: <span>${barcode}</span>
    </div>
  </div>
  <script>window.onload = function() { window.print() }<\/script>
</body>
</html>`)
  w.document.close()
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  kit: {
    id:               string
    barcode:          string
    status:           TestkitStatus
    badge_id:         string | null
    assigned:         boolean
    assignedClientId: string | null
    clientStatus:     string | null
    trackingCode:     string | null
    trackingUrl:      string | null
    returnTrackingCode: string | null
    returnTrackingUrl:  string | null
  }
  clientAddress?: ClientAddress
  returnAddressConfigured?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusActions({ kit, clientAddress, returnAddressConfigured }: Props) {
  const router = useRouter()
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [badgeId, setBadgeId]         = useState(kit.badge_id ?? '')
  const [sentDate, setSentDate]       = useState(new Date().toISOString().split('T')[0])
  const [badgeDate, setBadgeDate]     = useState(new Date().toISOString().split('T')[0])
  const [retourDate, setRetourDate]   = useState(new Date().toISOString().split('T')[0])
  const [resultsDate, setResultsDate] = useState(new Date().toISOString().split('T')[0])

  async function update(
    payload: Record<string, unknown>,
    clientSync?: { enrollment_status: string },
  ) {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from('vh_testkit').update(payload).eq('id', kit.id)
    if (err) { setError(err.message); setSaving(false); return }

    if (clientSync && kit.assignedClientId) {
      await supabase
        .from('vh_client')
        .update({ enrollment_status: clientSync.enrollment_status })
        .eq('id', kit.assignedClientId)
    }

    router.refresh()
    setSaving(false)
  }

  // ── PostNL: label + track&trace aanmaken, cliënt mailen, kit op verzonden ──
  const [postnlLoading, setPostnlLoading] = useState(false)

  async function createPostNLLabel() {
    setPostnlLoading(true)
    setError('')
    try {
      const res = await fetch('/api/postnl/label', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kitId: kit.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'PostNL-label aanmaken mislukt.'); return }

      // Label-PDF openen om te printen
      if (json.labelPdf) {
        const bytes = Uint8Array.from(atob(json.labelPdf), c => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        window.open(url, '_blank')
      }
      router.refresh()
    } catch {
      setError('Er ging iets mis bij het aanmaken van het PostNL-label.')
    } finally {
      setPostnlLoading(false)
    }
  }

  // ── PostNL: retourlabel aanmaken (geadresseerd aan het retouradres) ──────────
  const [returnLoading, setReturnLoading] = useState(false)

  async function createReturnLabel() {
    setReturnLoading(true)
    setError('')
    try {
      const res = await fetch('/api/postnl/return-label', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ kitId: kit.id }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Retourlabel aanmaken mislukt.'); return }

      if (json.labelPdf) {
        const bytes = Uint8Array.from(atob(json.labelPdf), c => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        window.open(url, '_blank')
      }
      router.refresh()
    } catch {
      setError('Er ging iets mis bij het aanmaken van het retourlabel.')
    } finally {
      setReturnLoading(false)
    }
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

      {/* PostNL track & trace (indien aangemaakt) */}
      {kit.trackingCode && (
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm">
          <span className="text-[#64748b]">Track &amp; trace: </span>
          <span className="font-mono font-medium text-[#1e293b]">{kit.trackingCode}</span>
          {kit.trackingUrl && (
            <a href={kit.trackingUrl} target="_blank" rel="noopener noreferrer"
               className="ml-2 text-xs text-[#1f1683] hover:underline">volgen bij PostNL →</a>
          )}
        </div>
      )}

      {/* assigned → kit_verstuurd */}
      {kit.status === 'assigned' && (() => {
        // Versturen mag pas nadat de arts de intake heeft goedgekeurd.
        // (Geldt voor cliënten; kits voor bedrijf/arbo hebben geen intake.)
        const needsApproval = !!kit.assignedClientId
        const approved = kit.clientStatus === 'intake_akkoord'

        if (needsApproval && !approved) {
          return (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Nog niet klaar om te versturen</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  De intake moet eerst door een arts worden goedgekeurd voordat er een
                  verzendlabel kan worden aangemaakt. Huidige status:{' '}
                  <span className="font-medium">{kit.clientStatus ?? 'onbekend'}</span>.
                </p>
              </div>
            </div>
          )
        }

        return (
        <div className="space-y-3">

          {/* PostNL: aanbevolen flow — label + track&trace + mail in één keer */}
          {clientAddress && (
            <div className="rounded-lg border border-[#c7d7fd] bg-[#eef4ff] p-3 space-y-2">
              <p className="text-sm font-medium text-[#1f1683]">Versturen via PostNL</p>
              <p className="text-xs text-[#64748b]">
                Maakt een verzendlabel + track &amp; trace aan, mailt de cliënt de trackingcode
                en zet de kit op &ldquo;verstuurd&rdquo;. Het label opent om te printen.
              </p>
              <button
                type="button"
                onClick={createPostNLLabel}
                disabled={postnlLoading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50"
              >
                {postnlLoading ? <RotateCcw size={14} className="animate-spin" /> : <Truck size={14} />}
                Verzendlabel aanmaken (PostNL)
              </button>
            </div>
          )}

          <p className="text-sm text-[#64748b] pt-1">
            Of registreer handmatig dat de testkit is verstuurd:
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px]">
              <Input
                label="Verzenddatum"
                type="date"
                value={sentDate}
                onChange={e => setSentDate(e.target.value)}
              />
            </div>
            <Button
              onClick={() => update(
                { status: 'kit_verstuurd', kit_sent_date: sentDate },
                { enrollment_status: 'kit_opgestuurd' },
              )}
              loading={saving}
              className="gap-2"
            >
              <Truck size={15} />
              Kit verstuurd
            </Button>
          </div>

          {/* Verzendlabel printen */}
          {clientAddress && (
            <div className="pt-1 border-t border-[#f1f5f9]">
              <button
                type="button"
                onClick={() => printLabel(clientAddress, kit.barcode)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
              >
                <Printer size={14} />
                Verzendlabel printen
              </button>
            </div>
          )}
        </div>
        )
      })()}

      {/* kit_verstuurd → retour */}
      {kit.status === 'kit_verstuurd' && (
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
              onClick={() => update(
                { status: 'retour', retour_date: retourDate },
                { enrollment_status: 'kit_retour' },
              )}
              loading={saving}
              className="gap-2"
            >
              <PackageCheck size={15} />
              Retour ontvangen
            </Button>
          </div>

          {/* Label nogmaals printen als de kit al verstuurd is */}
          {(kit.trackingCode || clientAddress) && (
            <div className="pt-1 border-t border-[#f1f5f9]">
              <button
                type="button"
                onClick={() => {
                  if (kit.trackingCode) {
                    // Specifieke PostNL-label van deze kit openen
                    window.open(`/api/postnl/label/${kit.id}`, '_blank')
                  } else if (clientAddress) {
                    // Fallback: oude HTML-label (kit zonder PostNL-label)
                    printLabel(clientAddress, kit.barcode)
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
              >
                <Printer size={14} />
                Verzendlabel opnieuw printen
              </button>
            </div>
          )}
        </div>
      )}

      {/* received → direct retour (edge case: niet-toegewezen kit) */}
      {kit.status === 'received' && (
        <div className="space-y-3">
          <p className="text-sm text-[#64748b]">
            Retour ontvangen van een niet-toegewezen kit?
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
              onClick={() => update(
                { status: 'results_available', results_date: resultsDate },
                { enrollment_status: 'uitslag_bekend' },
              )}
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

      {/* Retourlabel — beschikbaar zodra de kit klaarstaat om te versturen of is verstuurd */}
      {(kit.status === 'assigned' || kit.status === 'kit_verstuurd') && (
        <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 space-y-2">
          <p className="text-sm font-medium text-[#1e293b] flex items-center gap-2">
            <Undo2 size={14} className="text-[#64748b]" />
            Retourlabel
          </p>

          {kit.returnTrackingCode ? (
            <>
              <div className="text-sm">
                <span className="text-[#64748b]">Retour track &amp; trace: </span>
                <span className="font-mono font-medium text-[#1e293b]">{kit.returnTrackingCode}</span>
                {kit.returnTrackingUrl && (
                  <a href={kit.returnTrackingUrl} target="_blank" rel="noopener noreferrer"
                     className="ml-2 text-xs text-[#1f1683] hover:underline">volgen bij PostNL →</a>
                )}
              </div>
              <button
                type="button"
                onClick={() => window.open(`/api/postnl/return-label/${kit.id}`, '_blank')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-white transition-colors"
              >
                <Printer size={14} />
                Retourlabel opnieuw printen
              </button>
            </>
          ) : returnAddressConfigured ? (
            <>
              <p className="text-xs text-[#64748b]">
                Maakt een retourlabel aan met de kit-codering (<span className="font-mono">{kit.barcode}</span>) erop,
                geadresseerd aan het ingestelde retouradres. Het label opent om te printen en mee te sturen.
              </p>
              <button
                type="button"
                onClick={createReturnLabel}
                disabled={returnLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-[#1f1683] bg-white px-4 py-2 text-sm font-medium text-[#1f1683] hover:bg-[#eef4ff] transition-colors disabled:opacity-50"
              >
                {returnLoading ? <RotateCcw size={14} className="animate-spin" /> : <Undo2 size={14} />}
                Retourlabel aanmaken (PostNL)
              </button>
            </>
          ) : (
            <p className="text-xs text-[#64748b]">
              Stel eerst een <a href="/instellingen" className="text-[#1f1683] hover:underline">retouradres</a> in
              (Instellingen → Retouradres) om een retourlabel te kunnen aanmaken.
            </p>
          )}
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
                assigned:         'received',
                kit_verstuurd:    'assigned',
                retour:           'kit_verstuurd',
                sent_nightingale: 'retour',
                results_available:'sent_nightingale',
                received:         'received',
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
