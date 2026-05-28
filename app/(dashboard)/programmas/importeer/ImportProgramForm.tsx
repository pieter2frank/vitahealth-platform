'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileJson } from 'lucide-react'
import type { ProgramDefinition } from '@/types'

export function ImportProgramForm() {
  const router = useRouter()
  const [json, setJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    let parsed: ProgramDefinition
    try {
      parsed = JSON.parse(json)
    } catch {
      setError('Ongeldige JSON. Controleer de opmaak.')
      return
    }

    if (!parsed.id?.trim()) { setError('Veld "id" ontbreekt.'); return }
    if (!parsed.meta?.title?.trim()) { setError('Veld "meta.title" ontbreekt.'); return }
    if (!Array.isArray(parsed.schedule) || parsed.schedule.length === 0) {
      setError('Veld "schedule" ontbreekt of is leeg.'); return
    }

    setSaving(true)
    const supabase = createClient()

    const { data, error: dbErr } = await supabase
      .from('vh_program')
      .insert({
        slug: parsed.id.trim(),
        title: parsed.meta.title.trim(),
        description: parsed.meta.description ?? null,
        tags: parsed.meta.tags ?? [],
        is_premium: parsed.meta.isPremium ?? false,
        duration_days: parsed.meta.duration_days ?? null,
        status: 'active',
        json_content: parsed,
      })
      .select('id')
      .single()

    if (dbErr) {
      setError(dbErr.code === '23505'
        ? `Er bestaat al een programma met id "${parsed.id}".`
        : dbErr.message)
      setSaving(false)
      return
    }

    router.push(`/programmas/${data.id}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1e293b]">
          <FileJson size={15} className="text-[#94a3b8]" />
          JSON-definitie
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1e293b]">Plak JSON hieronder</label>
          <textarea
            value={json}
            onChange={e => { setJson(e.target.value); setError('') }}
            rows={18}
            placeholder={'{\n  "id": "mijn-programma",\n  "meta": {\n    "title": "Mijn Programma",\n    "description": "...",\n    "tags": ["mentaal"],\n    "isPremium": false,\n    "duration_days": 7\n  },\n  "schedule": [\n    {\n      "day_index": 1,\n      "type": "ACTION",\n      "title": "Dag 1",\n      "description": "...",\n      "content_blocks": []\n    }\n  ]\n}'}
            required
            className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm font-mono text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y"
          />
        </div>

        <div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3 text-xs text-[#64748b] space-y-1">
          <p className="font-medium text-[#1e293b]">Verwachte JSON-structuur:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><span className="font-mono">id</span> — unieke slug</li>
            <li><span className="font-mono">meta.title</span> — naam van het programma</li>
            <li><span className="font-mono">meta.tags</span> — array van tags</li>
            <li><span className="font-mono">meta.duration_days</span> — aantal dagen</li>
            <li><span className="font-mono">schedule</span> — array van dag-items met content_blocks</li>
          </ul>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <Button type="submit" loading={saving} size="lg" className="w-full">
        Programma importeren
      </Button>
    </form>
  )
}
