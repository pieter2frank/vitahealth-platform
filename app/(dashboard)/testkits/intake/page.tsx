'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScanLine, CheckCircle2, AlertCircle, X, ChevronDown } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { Testkit, Client, Company, Arbo } from '@/types'

type AssignType = 'client' | 'company' | 'arbo'

export default function IntakePage() {
  const router = useRouter()
  const barcodeRef = useRef<HTMLInputElement>(null)

  const [barcode, setBarcode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<Testkit | null | undefined>(undefined) // undefined=geen zoekopdracht, null=niet gevonden
  const [error, setError] = useState('')

  // Toewijzing
  const [assignType, setAssignType] = useState<AssignType | ''>('')
  const [assignSearch, setAssignSearch] = useState('')
  const [assignResults, setAssignResults] = useState<(Client | Company | Arbo)[]>([])
  const [selectedAssign, setSelectedAssign] = useState<Client | Company | Arbo | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    barcodeRef.current?.focus()
  }, [])

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault()
    if (!barcode.trim()) return
    setScanning(true)
    setError('')
    setFound(undefined)
    setSelectedAssign(null)
    setAssignType('')
    setAssignSearch('')

    const supabase = createClient()
    const { data } = await supabase
      .from('vh_testkit')
      .select('*, vh_client(*), vh_company(*), vh_arbo(*)')
      .eq('barcode', barcode.trim())
      .maybeSingle()

    setFound(data as Testkit | null)
    setScanning(false)
  }

  async function searchAssign(value: string) {
    setAssignSearch(value)
    setShowDropdown(true)
    if (!value.trim() || !assignType) {
      setAssignResults([])
      return
    }
    const supabase = createClient()
    const table = assignType === 'client' ? 'vh_client' : assignType === 'company' ? 'vh_company' : 'vh_arbo'
    const searchField = assignType === 'client' ? 'last_name' : 'name'

    const { data } = await supabase
      .from(table)
      .select('*')
      .ilike(searchField, `%${value}%`)
      .limit(8)

    setAssignResults((data ?? []) as (Client | Company | Arbo)[])
  }

  function getAssignLabel(item: Client | Company | Arbo) {
    if (assignType === 'client') {
      const c = item as Client
      return `${c.first_name} ${c.last_name}${c.email ? ' · ' + c.email : ''}`
    }
    return (item as Company | Arbo).name
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const now = new Date().toISOString()

    if (found === null) {
      // Nieuwe kit invoeren
      const payload: Record<string, unknown> = {
        barcode: barcode.trim(),
        date: now,
        status: selectedAssign ? 'assigned' : 'received',
        assigned: !!selectedAssign,
      }
      if (selectedAssign && assignType === 'client') payload.assigned_client_id = selectedAssign.id
      if (selectedAssign && assignType === 'company') payload.assigned_company_id = selectedAssign.id
      if (selectedAssign && assignType === 'arbo') payload.assigned_arbo_id = selectedAssign.id
      if (selectedAssign) payload.assigned_date = now

      const { error: insertError } = await supabase.from('vh_testkit').insert(payload)
      if (insertError) { setError(insertError.message); setSaving(false); return }
    } else {
      // Bestaande kit updaten (toewijzing)
      if (!found) { setSaving(false); return }
      const payload: Record<string, unknown> = {
        status: selectedAssign ? 'assigned' : found.status,
        assigned: !!selectedAssign || found.assigned,
      }
      if (selectedAssign && assignType === 'client') { payload.assigned_client_id = selectedAssign.id; payload.assigned_date = now }
      if (selectedAssign && assignType === 'company') { payload.assigned_company_id = selectedAssign.id; payload.assigned_date = now }
      if (selectedAssign && assignType === 'arbo') { payload.assigned_arbo_id = selectedAssign.id; payload.assigned_date = now }

      const { error: updateError } = await supabase.from('vh_testkit').update(payload).eq('id', found.id)
      if (updateError) { setError(updateError.message); setSaving(false); return }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setBarcode('')
      setFound(undefined)
      setSelectedAssign(null)
      setAssignType('')
      barcodeRef.current?.focus()
    }, 1800)
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e293b]">Testkit inscannen</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Scan of typ een barcode om een kit in te voeren of toe te wijzen.</p>
      </div>

      {/* Barcode invoer */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm mb-4">
        <form onSubmit={handleLookup} className="flex gap-3">
          <div className="flex-1">
            <Input
              ref={barcodeRef}
              label="Barcode"
              value={barcode}
              onChange={e => { setBarcode(e.target.value); setFound(undefined); setError('') }}
              placeholder="Scan of typ de barcode..."
              autoComplete="off"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={scanning} className="gap-2">
              <ScanLine size={16} />
              Zoeken
            </Button>
          </div>
        </form>
      </div>

      {/* Resultaat */}
      {found === null && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-[#eef4ff] border border-[#c7d9ff] p-3">
            <CheckCircle2 size={18} className="text-[#1f1683] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#1f1683]">Nieuwe testkit</p>
              <p className="text-xs text-[#64748b]">
                Barcode <span className="font-mono font-semibold">{barcode}</span> is nog niet beknd. Kit wordt nu ingevoerd.
              </p>
            </div>
          </div>
          <AssignSection
            assignType={assignType}
            setAssignType={(t) => { setAssignType(t); setSelectedAssign(null); setAssignSearch('') }}
            assignSearch={assignSearch}
            onSearch={searchAssign}
            assignResults={assignResults}
            selectedAssign={selectedAssign}
            setSelectedAssign={setSelectedAssign}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            getLabel={getAssignLabel}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={handleSave} loading={saving} size="lg">
              {saved ? '✓ Opgeslagen' : 'Kit opslaan'}
            </Button>
            <Button variant="outline" onClick={() => router.push('/testkits')}>Annuleren</Button>
          </div>
        </div>
      )}

      {found && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
            <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700">Testkit al bekend</p>
              <p className="text-xs text-[#64748b]">
                Ingevoerd op {formatDateTime(found.date)} · Status: <StatusLabel status={found.status} />
              </p>
            </div>
          </div>

          {found.assigned && (
            <div className="text-sm text-[#64748b] bg-[#f8fafc] rounded-lg p-3 border border-[#e2e8f0]">
              {found.vh_client && (
                <span>Toegewezen aan: <strong>{(found.vh_client as Client).first_name} {(found.vh_client as Client).last_name}</strong></span>
              )}
              {found.vh_company && (
                <span>Toegewezen aan bedrijf: <strong>{(found.vh_company as Company).name}</strong></span>
              )}
              {found.vh_arbo && (
                <span>Toegewezen aan arbodienst: <strong>{(found.vh_arbo as Arbo).name}</strong></span>
              )}
            </div>
          )}

          <AssignSection
            assignType={assignType}
            setAssignType={(t) => { setAssignType(t); setSelectedAssign(null); setAssignSearch('') }}
            assignSearch={assignSearch}
            onSearch={searchAssign}
            assignResults={assignResults}
            selectedAssign={selectedAssign}
            setSelectedAssign={setSelectedAssign}
            showDropdown={showDropdown}
            setShowDropdown={setShowDropdown}
            getLabel={getAssignLabel}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <Button onClick={handleSave} loading={saving} disabled={!selectedAssign} size="lg">
              {saved ? '✓ Opgeslagen' : 'Toewijzing opslaan'}
            </Button>
            <Button variant="outline" onClick={() => router.push(`/testkits/${found!.id}`)}>
              Details bekijken
            </Button>
          </div>
        </div>
      )}

      {saved && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          Succesvol opgeslagen. Klaar voor volgende scan.
        </div>
      )}
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  const map: Record<string, string> = {
    received: 'Ontvangen', assigned: 'Toegewezen', retour: 'Retour',
    sent_nightingale: 'Verzonden NHG', results_available: 'Resultaten',
  }
  return <strong>{map[status] ?? status}</strong>
}

interface AssignSectionProps {
  assignType: AssignType | ''
  setAssignType: (t: AssignType | '') => void
  assignSearch: string
  onSearch: (v: string) => void
  assignResults: (Client | Company | Arbo)[]
  selectedAssign: Client | Company | Arbo | null
  setSelectedAssign: (v: Client | Company | Arbo | null) => void
  showDropdown: boolean
  setShowDropdown: (v: boolean) => void
  getLabel: (item: Client | Company | Arbo) => string
}

function AssignSection({
  assignType, setAssignType, assignSearch, onSearch,
  assignResults, selectedAssign, setSelectedAssign,
  showDropdown, setShowDropdown, getLabel,
}: AssignSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#374151]">Toewijzen aan <span className="text-[#94a3b8] font-normal">(optioneel)</span></p>
      <div className="flex gap-2">
        {(['client', 'company', 'arbo'] as AssignType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAssignType(assignType === t ? '' : t)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              assignType === t
                ? 'bg-[#1f1683] text-white border-[#1f1683]'
                : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683] hover:text-[#1f1683]'
            }`}
          >
            {t === 'client' ? 'Cliënt' : t === 'company' ? 'Bedrijf' : 'Arbodienst'}
          </button>
        ))}
      </div>

      {assignType && (
        <div className="relative">
          {selectedAssign ? (
            <div className="flex items-center justify-between rounded-lg border border-[#1f1683] bg-[#eef4ff] px-3 py-2">
              <span className="text-sm text-[#1f1683] font-medium">{getLabel(selectedAssign)}</span>
              <button
                type="button"
                onClick={() => { setSelectedAssign(null); onSearch('') }}
                className="text-[#94a3b8] hover:text-red-500"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder={
                  assignType === 'client' ? 'Zoek op achternaam...'
                  : assignType === 'company' ? 'Zoek op bedrijfsnaam...'
                  : 'Zoek op naam arbodienst...'
                }
                value={assignSearch}
                onChange={e => onSearch(e.target.value)}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && assignResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg overflow-hidden">
                  {assignResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9] last:border-0"
                      onMouseDown={() => {
                        setSelectedAssign(item)
                        setShowDropdown(false)
                      }}
                    >
                      {getLabel(item)}
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && assignSearch && assignResults.length === 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-[#e2e8f0] bg-white shadow-lg p-3 text-center text-sm text-[#94a3b8]">
                  Geen resultaten gevonden.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
