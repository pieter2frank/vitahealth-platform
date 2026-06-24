'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MessageSquare, Check, Loader2 } from 'lucide-react'

export function KitNotes({ kitId, initialNotes }: { kitId: string; initialNotes: string | null }) {
  const router = useRouter()
  const [notes, setNotes]   = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)
  const [error, setError]   = useState('')

  const dirty = notes !== (initialNotes ?? '')

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    const supabase = createClient()
    const { error: err } = await supabase
      .from('vh_testkit')
      .update({ notes: notes.trim() || null })
      .eq('id', kitId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-[#1e293b] mb-3 flex items-center gap-2">
        <MessageSquare size={15} className="text-[#94a3b8]" />
        Opmerkingen
      </h2>
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={4}
        placeholder="Bijv. afname mislukt — vervangkit opgestuurd op 24-06."
        className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y"
      />
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-3 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Opslaan
        </button>
        {saved && <span className="text-xs text-emerald-600">Opgeslagen</span>}
      </div>
    </div>
  )
}
