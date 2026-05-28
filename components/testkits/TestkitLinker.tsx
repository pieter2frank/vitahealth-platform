'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanLine, TestTube2, X, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AvailableKit {
  id: string
  barcode: string
  date: string
}

interface Props {
  clientId: string
  clientName: string
}

export function TestkitLinker({ clientId, clientName }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [barcode, setBarcode] = useState('')
  const [suggestions, setSuggestions] = useState<AvailableKit[]>([])
  const [searchResults, setSearchResults] = useState<AvailableKit[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Laad bij mount: top 5 beschikbare kits als suggesties
  useEffect(() => {
    async function loadSuggestions() {
      const supabase = createClient()
      const { data } = await supabase
        .from('vh_testkit')
        .select('id, barcode, date')
        .eq('status', 'received')
        .eq('assigned', false)
        .order('date', { ascending: false })
        .limit(5)
      setSuggestions((data ?? []) as AvailableKit[])
    }
    loadSuggestions()
  }, [])

  // Zoek op barcode terwijl de gebruiker typt
  async function handleSearch(value: string) {
    setBarcode(value)
    setError('')
    if (!value.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const supabase = createClient()
    const { data } = await supabase
      .from('vh_testkit')
      .select('id, barcode, date')
      .ilike('barcode', `%${value}%`)
      .eq('assigned', false)
      .order('date', { ascending: false })
      .limit(8)
    setSearchResults((data ?? []) as AvailableKit[])
    setShowDropdown(true)
  }

  async function assignKit(kit: AvailableKit) {
    setSaving(true)
    setError('')
    setShowDropdown(false)
    setBarcode(kit.barcode)

    const supabase = createClient()
    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('vh_testkit')
      .update({
        assigned: true,
        assigned_client_id: clientId,
        assigned_date: now,
        status: 'assigned',
      })
      .eq('id', kit.id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    setMessage(`Testkit ${kit.barcode} is gekoppeld aan ${clientName}.`)
    setSaving(false)
    setTimeout(() => router.refresh(), 800)
  }

  const displayList = barcode.trim() ? searchResults : suggestions

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2">
        <ScanLine size={16} className="text-[#1f1683]" />
        <h2 className="text-sm font-semibold text-[#1e293b]">Testkit koppelen</h2>
      </div>

      {message ? (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <TestTube2 size={15} />
          {message}
        </div>
      ) : (
        <>
          {/* Zoekveld */}
          <div className="relative">
            <div className="relative">
              <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                ref={inputRef}
                value={barcode}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="Scan of typ een barcode..."
                className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm font-mono text-[#1e293b] placeholder:text-[#94a3b8] placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
                autoComplete="off"
              />
              {barcode && (
                <button
                  type="button"
                  onClick={() => { setBarcode(''); setSearchResults([]); setShowDropdown(false) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && displayList.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg overflow-hidden">
                {!barcode.trim() && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <Lightbulb size={12} className="text-amber-500" />
                    <span className="text-xs text-[#64748b]">Beschikbare testkits (niet toegewezen)</span>
                  </div>
                )}
                {displayList.map((kit) => (
                  <button
                    key={kit.id}
                    type="button"
                    onMouseDown={() => assignKit(kit)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-[#eef4ff] transition-colors border-b border-[#f1f5f9] last:border-0"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-md bg-[#eef4ff] flex items-center justify-center shrink-0">
                        <TestTube2 size={13} className="text-[#1f1683]" />
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
                Geen vrije testkit gevonden met barcode &ldquo;{barcode}&rdquo;.
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {suggestions.length === 0 && !barcode && (
            <p className="text-xs text-[#94a3b8] flex items-center gap-1.5">
              <Lightbulb size={12} className="text-amber-500" />
              Geen vrije testkits beschikbaar. Scan eerst nieuwe kits in via{' '}
              <a href="/testkits/intake" className="text-[#1f1683] hover:underline">Testkits → Inscannen</a>.
            </p>
          )}
        </>
      )}
    </div>
  )
}
