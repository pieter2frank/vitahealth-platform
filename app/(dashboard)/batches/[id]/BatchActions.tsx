'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FlaskConical, AlertTriangle } from 'lucide-react'

interface Props {
  batchId: string
  kitCount: number
}

export function BatchActions({ batchId, kitCount }: Props) {
  const router = useRouter()
  const [resultsDate, setResultsDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleResults() {
    setSaving(true)
    setError('')
    const supabase = createClient()

    // 1. Batch status bijwerken
    const { error: batchErr } = await supabase
      .from('vh_batch')
      .update({ status: 'results_received', results_date: resultsDate })
      .eq('id', batchId)

    if (batchErr) { setError(batchErr.message); setSaving(false); return }

    // 2. Alle testkits in deze batch bijwerken
    const { error: kitErr } = await supabase
      .from('vh_testkit')
      .update({ status: 'results_available', results_date: resultsDate })
      .eq('batch_id', batchId)

    if (kitErr) { setError(kitErr.message); setSaving(false); return }

    router.refresh()
    setSaving(false)
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-[#1e293b]">Resultaten registreren</h2>
      <p className="text-sm text-[#64748b]">
        Zijn de analyseresultaten van Nightingale Health ontvangen?
        Dit zet alle <strong>{kitCount} testkits</strong> in deze batch op &ldquo;Resultaten beschikbaar&rdquo;.
      </p>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            label="Datum resultaten ontvangen"
            type="date"
            value={resultsDate}
            onChange={e => setResultsDate(e.target.value)}
          />
        </div>
        <Button
          onClick={handleResults}
          loading={saving}
          variant="accent"
          className="gap-2 shrink-0"
        >
          <FlaskConical size={15} />
          Resultaten ontvangen
        </Button>
      </div>
    </div>
  )
}
