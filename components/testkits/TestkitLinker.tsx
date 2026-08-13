'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanLine, TestTube2, X, Lightbulb, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface AvailableKit {
  id: string
  barcode: string
  date: string
}

interface Props {
  clientId:   string
  clientName: string
}

export function TestkitLinker({ clientId, clientName }: Props) {
  const router   = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  const [barcode,      setBarcode]      = useState('')
  const [suggestions,  setSuggestions]  = useState<AvailableKit[]>([])
  const [searchResults,setSearchResults]= useState<AvailableKit[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [message,      setMessage]      = useState('')

  // Beschikbare kits laden bij mount (suggesties)
  useEffect(() => {
    createClient()
      .from('vh_testkit')
      .select('id, barcode, date')
      .eq('status', 'received')
      .eq('assigned', false)
      .order('date', { ascending: false })
      .limit(5)
      .then(({ data }) => setSuggestions((data ?? []) as AvailableKit[]))
  }, [])

  // Refocus na verwerking
  useEffect(() => {
    if (!saving) inputRef.current?.focus()
  }, [saving])

  // ── Kern: barcode verwerken (scanner of Enter) ───────────────────────────────
  const processBarcode = useCallback(async (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed || saving) return

    setSaving(true)
    setError('')
    setMessage('')
    setShowDropdown(false)
    setBarcode('')

    const supabase = createClient()
    const now = new Date().toISOString()

    // Kit opzoeken (ook al toegewezen kits meenemen voor foutmelding)
    const { data: kit } = await supabase
      .from('vh_testkit')
      .select('id, barcode, assigned, vh_client(id)')
      .eq('barcode', trimmed)
      .maybeSingle()

    if (!kit) {
      // Nieuwe kit: aanmaken + direct toewijzen
      const { error: insertErr } = await supabase
        .from('vh_testkit')
        .insert({
          barcode:            trimmed,
          date:               now,
          status:             'assigned',
          assigned:           true,
          assigned_client_id: clientId,
          assigned_date:      now,
        })
      if (insertErr) { setError(insertErr.message); setSaving(false); return }
      setMessage(`Testkit ${trimmed} is toegewezen aan ${clientName}.`)

    } else if (kit.assigned) {
      // Al gekoppeld aan iemand anders — naam via de server route (PII-kluis).
      const cid = (kit.vh_client as unknown as { id: string } | null)?.id
      let owner = 'een andere cliënt'
      if (cid) {
        try {
          const j = await (await fetch(`/api/clients/search?id=${cid}`)).json()
          owner = j.results?.[0]?.name || owner
        } catch { /* naam is nice-to-have */ }
      }
      setError(`Kit al gekoppeld aan ${owner}.`)
      setSaving(false)
      return

    } else {
      // Bestaande vrije kit toewijzen
      const { error: updateErr } = await supabase
        .from('vh_testkit')
        .update({
          assigned:           true,
          assigned_client_id: clientId,
          assigned_date:      now,
          status:             'assigned',
        })
        .eq('id', kit.id)
      if (updateErr) { setError(updateErr.message); setSaving(false); return }
      setMessage(`Testkit ${trimmed} is toegewezen aan ${clientName}.`)
    }

    setSaving(false)
    setTimeout(() => router.refresh(), 600)
  }, [clientId, clientName, saving, router])

  // ── Zoeken terwijl de gebruiker typt (dropdown) ──────────────────────────────
  async function handleSearch(value: string) {
    setBarcode(value)
    setError('')
    setMessage('')
    if (!value.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const { data } = await createClient()
      .from('vh_testkit')
      .select('id, barcode, date')
      .ilike('barcode', `%${value}%`)
      .eq('assigned', false)
      .order('date', { ascending: false })
      .limit(8)
    setSearchResults((data ?? []) as AvailableKit[])
    setShowDropdown(true)
  }

  // Dropdown-selectie (muis of touch)
  async function assignFromDropdown(kit: AvailableKit) {
    setShowDropdown(false)
    setBarcode(kit.barcode)
    await processBarcode(kit.barcode)
  }

  const displayList = barcode.trim() ? searchResults : suggestions

  return (
    <div className="space-y-3">

      {/* ── Scanveld ─────────────────────────────────────────────────────── */}
      <div className="relative">
        <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
        <input
          ref={inputRef}
          value={barcode}
          onChange={e => handleSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); processBarcode(barcode) }
          }}
          disabled={saving}
          placeholder="Scan barcode of typ + Enter…"
          autoComplete="off"
          spellCheck={false}
          className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-8 text-sm font-mono text-[#1e293b] placeholder:text-[#94a3b8] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683] disabled:opacity-60 transition-colors"
        />
        {saving ? (
          <Loader2 size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-[#1f1683]" />
        ) : barcode ? (
          <button
            type="button"
            onClick={() => { setBarcode(''); setSearchResults([]); setShowDropdown(false); setError(''); setMessage('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
          >
            <X size={14} />
          </button>
        ) : null}

        {/* ── Dropdown ───────────────────────────────────────────────────── */}
        {showDropdown && displayList.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg overflow-hidden">
            {!barcode.trim() && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
                <Lightbulb size={12} className="text-amber-500" />
                <span className="text-xs text-[#64748b]">Beschikbare testkits</span>
              </div>
            )}
            {displayList.map((kit) => (
              <button
                key={kit.id}
                type="button"
                onMouseDown={() => assignFromDropdown(kit)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#eef4ff] transition-colors border-b border-[#f1f5f9] last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-6 w-6 rounded-md bg-[#eef4ff] flex items-center justify-center shrink-0">
                    <TestTube2 size={12} className="text-[#1f1683]" />
                  </div>
                  <span className="text-sm font-mono font-medium text-[#1e293b]">{kit.barcode}</span>
                </div>
                <span className="text-xs text-[#94a3b8]">
                  {new Date(kit.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        )}

        {showDropdown && barcode.trim() && searchResults.length === 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg p-3 text-center text-sm text-[#94a3b8]">
            Geen vrije kit gevonden — druk Enter om&nbsp;<span className="font-mono font-medium text-[#1e293b]">{barcode}</span>&nbsp;in te voeren en toe te wijzen.
          </div>
        )}
      </div>

      {/* ── Feedback ─────────────────────────────────────────────────────── */}
      {message && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 size={14} className="shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Geen kits beschikbaar ─────────────────────────────────────────── */}
      {suggestions.length === 0 && !barcode && !message && (
        <p className="text-xs text-[#94a3b8] flex items-center gap-1.5">
          <Lightbulb size={12} className="text-amber-500 shrink-0" />
          Geen vrije kits in voorraad — scan een nieuwe barcode en druk Enter om die direct aan te maken en toe te wijzen.
        </p>
      )}
    </div>
  )
}
