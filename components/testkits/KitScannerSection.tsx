'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanLine, CheckCircle2, AlertCircle, Loader2, XCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EntityType = 'arbo' | 'company'

type ScanStatus = 'ok_new' | 'ok_existing' | 'already_assigned' | 'error'

interface ScanResult {
  barcode: string
  status: ScanStatus
  message: string
}

interface Props {
  entityId:   string
  entityType: EntityType
}

// ─── Hulpfunctie: scanner vs. handmatig onderscheiden ─────────────────────────
// Een barcode scanner stuurt alle tekens binnen ~50ms; handmatig typen duurt langer.
// We registreren de tijd van het eerste teken en als Enter binnen 100ms volgt
// na de eerste keystroke, beschouwen we het als een scan.
// In de praktijk: beide gevallen activeren via Enter — het verschil zit erin
// dat de scanner de Enter zelf stuurt, de gebruiker hem handmatig indrukt.
// De interface hoeft dit niet te onderscheiden; Enter = verwerken.

// ─── Component ────────────────────────────────────────────────────────────────

export function KitScannerSection({ entityId, entityType }: Props) {
  const router                  = useRouter()
  const inputRef                = useRef<HTMLInputElement>(null)
  const [barcode, setBarcode]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [scans, setScans]       = useState<ScanResult[]>([])

  // Auto-focus bij mounten én na elke verwerking (ook na router.refresh())
  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (!loading) inputRef.current?.focus()
  }, [loading])

  const processBarcode = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setBarcode('')

    const supabase = createClient()
    const now      = new Date().toISOString()

    // ── Zoek bestaande kit ──────────────────────────────────────────────────
    const { data: kit, error: lookupErr } = await supabase
      .from('vh_testkit')
      .select('id, barcode, assigned, status')
      .eq('barcode', trimmed)
      .maybeSingle()

    if (lookupErr) {
      setScans(prev => [
        { barcode: trimmed, status: 'error', message: lookupErr.message },
        ...prev,
      ].slice(0, 15))
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    // ── Payload voor de toewijzing ──────────────────────────────────────────
    const assignPayload: Record<string, unknown> = {
      status:        'assigned',
      assigned:      true,
      assigned_date: now,
    }
    if (entityType === 'arbo')    assignPayload.assigned_arbo_id    = entityId
    if (entityType === 'company') assignPayload.assigned_company_id = entityId

    let result: ScanResult

    if (!kit) {
      // ── Nieuwe kit: aanmaken + toewijzen ───────────────────────────────────
      const { error } = await supabase
        .from('vh_testkit')
        .insert({ barcode: trimmed, date: now, ...assignPayload })

      result = error
        ? { barcode: trimmed, status: 'error',    message: error.message }
        : { barcode: trimmed, status: 'ok_new',   message: 'Nieuw — ingevoerd en toegewezen' }
    } else if (kit.assigned) {
      // ── Al toegewezen aan iemand ──────────────────────────────────────────
      result = {
        barcode: trimmed,
        status:  'already_assigned',
        message: 'Let op: al eerder toegewezen',
      }
    } else {
      // ── Bestaande ongebonden kit toewijzen ────────────────────────────────
      const { error } = await supabase
        .from('vh_testkit')
        .update(assignPayload)
        .eq('id', kit.id)

      result = error
        ? { barcode: trimmed, status: 'error',       message: error.message }
        : { barcode: trimmed, status: 'ok_existing', message: 'Bestaande kit toegewezen' }
    }

    setScans(prev => [result, ...prev].slice(0, 15))
    // Ververs de serverside kittabel op de pagina
    if (result.status !== 'error') router.refresh()

    // loading → false triggert de useEffect die focus terugzet
    setLoading(false)
  }, [entityId, entityType, loading, router])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      processBarcode(barcode)
    }
  }

  return (
    <div className="border-b border-[#e2e8f0] px-5 py-4 space-y-3 bg-[#f8fafc]">

      {/* Invoerveld */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <ScanLine
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
          />
          <input
            ref={inputRef}
            value={barcode}
            onChange={e => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            autoComplete="off"
            spellCheck={false}
            placeholder="Scan barcode of typ + Enter…"
            className="w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-4 py-2 text-sm font-mono text-[#1e293b] placeholder:text-[#94a3b8] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683] disabled:opacity-60 transition-colors"
          />
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-[#1f1683] shrink-0" />}
      </div>

      {/* Scanhistorie (deze sessie) */}
      {scans.length > 0 && (
        <ul className="space-y-1">
          {scans.map((s, i) => (
            <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${
              s.status === 'ok_new' || s.status === 'ok_existing'
                ? 'bg-green-50 text-green-700'
                : s.status === 'already_assigned'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {s.status === 'ok_new' || s.status === 'ok_existing'
                ? <CheckCircle2 size={12} className="shrink-0" />
                : s.status === 'already_assigned'
                ? <AlertCircle  size={12} className="shrink-0" />
                : <XCircle      size={12} className="shrink-0" />
              }
              <span className="font-mono font-semibold">{s.barcode}</span>
              <span className="text-[11px] opacity-80">— {s.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
