'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { DateInput } from '@/components/ui/date-input'
import { Button } from '@/components/ui/button'
import { TestTube2, Package, AlertTriangle, CheckSquare2, Square } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// Batchcode opbouwen: NL-NH-yyyy-00001/010
function buildBadgeId(year: number, seq: number, kitCount: number): string {
  return `NL-NH-${year}-${String(seq).padStart(5, '0')}/${String(kitCount).padStart(3, '0')}`
}

interface RetourKit {
  id: string
  barcode: string
  retour_date: string | null
  sample_date: string | null
  assignedName: string
}

interface Props {
  retourKits: RetourKit[]
}

export function BatchForm({ retourKits }: Props) {
  const router = useRouter()

  const [sentDate, setSentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  // Alleen kits met een afnamedatum mogen in een batch
  const selectableKits = retourKits.filter(k => k.sample_date)
  const blockedCount = retourKits.length - selectableKits.length
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(selectableKits.map(k => k.id))
  )
  const [previewSeq, setPreviewSeq] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Jaar uit verzenddatum (fallback: huidig jaar)
  const year = sentDate ? new Date(sentDate).getFullYear() : new Date().getFullYear()

  // Volgnummer ophalen voor live preview (zonder te reserveren)
  useEffect(() => {
    const supabase = createClient()
    supabase.rpc('peek_batch_seq', { p_year: year }).then(({ data }) => {
      if (typeof data === 'number') setPreviewSeq(data)
    })
  }, [year])

  // Live preview van de batchcode
  const badgePreview = previewSeq !== null
    ? buildBadgeId(year, previewSeq, selected.size || 0)
    : null

  const allSelected = selected.size === selectableKits.length && selectableKits.length > 0
  const noneSelected = selected.size === 0

  function toggle(id: string) {
    const kit = retourKits.find(k => k.id === id)
    if (!kit?.sample_date) return // zonder afnamedatum niet selecteerbaar
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(selectableKits.map(k => k.id)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (noneSelected) { setError('Selecteer minimaal één testkit.'); return }

    setSaving(true)
    const supabase = createClient()
    const ids = Array.from(selected)

    // 1. Volgnummer reserveren (atomair) en batchcode opbouwen
    const { data: seq, error: seqErr } = await supabase.rpc('next_batch_seq', { p_year: year })
    if (seqErr || typeof seq !== 'number') {
      setError(seqErr?.message ?? 'Batchnummer genereren mislukt.')
      setSaving(false)
      return
    }
    const badgeId = buildBadgeId(year, seq, ids.length)

    // 2. Batch aanmaken
    const { data: batch, error: batchErr } = await supabase
      .from('vh_batch')
      .insert({
        badge_id: badgeId,
        sent_date: sentDate,
        notes: notes.trim() || null,
        status: 'sent',
      })
      .select('id')
      .single()

    if (batchErr || !batch) {
      setError(batchErr?.message ?? 'Batch aanmaken mislukt.')
      setSaving(false)
      return
    }

    // 3. Geselecteerde testkits bijwerken
    const { error: updateErr } = await supabase
      .from('vh_testkit')
      .update({
        batch_id: batch.id,
        badge_id: badgeId,
        badge_datesent: sentDate,
        status: 'sent_nightingale',
      })
      .in('id', ids)

    if (updateErr) {
      // Batch terugdraaien bij fout
      await supabase.from('vh_batch').delete().eq('id', batch.id)
      setError(updateErr.message)
      setSaving(false)
      return
    }

    router.push(`/batches/${batch.id}`)
  }

  if (retourKits.length === 0) {
    return (
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-10 shadow-sm text-center">
        <Package size={36} className="text-[#cbd5e1] mx-auto mb-3" />
        <p className="text-sm font-medium text-[#64748b]">Geen testkits klaar voor batch</p>
        <p className="text-xs text-[#94a3b8] mt-1">
          Er zijn momenteel geen testkits met status &ldquo;Retour&rdquo; die nog niet aan een batch zijn toegewezen.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      {/* Linkerkant: batchgegevens */}
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-[#1e293b]">Batchgegevens</h2>

          {/* Automatisch gegenereerde batchcode */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">
              Batchcode <span className="text-[#94a3b8] font-normal">(automatisch)</span>
            </label>
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
              <span className="font-mono text-sm font-semibold text-[#1f1683]">
                {badgePreview ?? `NL-NH-${year}-…/${String(selected.size || 0).padStart(3, '0')}`}
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Het volgnummer ({previewSeq !== null ? String(previewSeq).padStart(5, '0') : '…'})
              wordt definitief toegekend bij aanmaken. De laatste 3 cijfers zijn het aantal kits.
            </p>
          </div>

          <DateInput
            label="Verzenddatum"
            value={sentDate}
            onChange={setSentDate}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">
              Opmerkingen <span className="text-[#94a3b8] font-normal">(optioneel)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Bijv. speciale instructies voor NH..."
              className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-none"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
            <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          loading={saving}
          size="lg"
          className="w-full gap-2"
          disabled={noneSelected}
        >
          <Package size={15} />
          Batch aanmaken ({selected.size} kit{selected.size === 1 ? '' : 's'})
        </Button>
      </div>

      {/* Rechterkant: kit selectie */}
      <div className="lg:col-span-3">
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3 bg-[#f8fafc]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className="text-[#64748b] hover:text-[#1f1683] transition-colors"
                title={allSelected ? 'Alles deselecteren' : 'Alles selecteren'}
              >
                {allSelected
                  ? <CheckSquare2 size={16} className="text-[#1f1683]" />
                  : <Square size={16} />
                }
              </button>
              <span className="text-xs font-medium text-[#64748b]">
                Testkits — {selected.size} van {selectableKits.length} geselecteerd
              </span>
            </div>
            <span className="text-xs text-[#94a3b8]">Status: Retour</span>
          </div>

          {blockedCount > 0 && (
            <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5">
              <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                {blockedCount} kit{blockedCount === 1 ? '' : 's'} {blockedCount === 1 ? 'heeft' : 'hebben'} geen
                afnamedatum en {blockedCount === 1 ? 'kan' : 'kunnen'} niet in een batch. Vul de afnamedatum in op de
                kit-pagina.
              </p>
            </div>
          )}

          {/* Kit lijst */}
          <div className="divide-y divide-[#f1f5f9] max-h-[480px] overflow-y-auto">
            {retourKits.map((kit) => {
              const blocked = !kit.sample_date
              const isSelected = selected.has(kit.id)
              return (
                <label
                  key={kit.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                    blocked
                      ? 'bg-amber-50/40 cursor-not-allowed'
                      : isSelected ? 'bg-[#eef4ff] cursor-pointer' : 'hover:bg-[#f8fafc] cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={blocked}
                    onChange={() => toggle(kit.id)}
                    className="h-4 w-4 rounded border-[#e2e8f0] accent-[#1f1683] shrink-0 disabled:opacity-40"
                  />
                  <div className="h-8 w-8 rounded-lg bg-[#eef4ff] flex items-center justify-center shrink-0">
                    <TestTube2 size={14} className="text-[#1f1683]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-medium text-[#1e293b]">{kit.barcode}</p>
                    <p className="text-xs text-[#64748b] truncate">{kit.assignedName}</p>
                    {blocked && (
                      <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                        <AlertTriangle size={11} className="shrink-0" />
                        Afnamedatum ontbreekt —{' '}
                        <a
                          href={`/testkits/${kit.id}`}
                          onClick={e => e.stopPropagation()}
                          className="underline hover:text-amber-900"
                        >
                          invullen
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {blocked ? (
                      <p className="text-xs font-medium text-amber-600">Geblokkeerd</p>
                    ) : (
                      <>
                        <p className="text-xs text-[#94a3b8]">Afname</p>
                        <p className="text-xs text-[#64748b]">{formatDate(kit.sample_date)}</p>
                      </>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </form>
  )
}
