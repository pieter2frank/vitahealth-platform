'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { AlertTriangle, FileJson } from 'lucide-react'
import type { QuestionnaireDefinition } from '@/types'

const EXAMPLE = JSON.stringify({
  id: "mijn-vragenlijst",
  title: "Mijn Vragenlijst",
  status: "active",
  questions: [
    { id: "q1", type: "radio", label: "Geslacht", required: true, options: [{ value: "m", label: "Man" }, { value: "v", label: "Vrouw" }] },
    { id: "q2", type: "number", label: "Leeftijd", required: true },
    { id: "q3", type: "long_text", label: "Wat is je doel?", required: false }
  ]
}, null, 2)

export function ImportQuestionnaireForm() {
  const router = useRouter()
  const [json, setJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // Parseer JSON
    let parsed: QuestionnaireDefinition
    try {
      parsed = JSON.parse(json)
    } catch {
      setError('Ongeldige JSON. Controleer de opmaak.')
      return
    }

    // Valideer verplichte velden
    if (!parsed.id?.trim()) { setError('Veld "id" ontbreekt.'); return }
    if (!parsed.title?.trim()) { setError('Veld "title" ontbreekt.'); return }
    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      setError('Veld "questions" ontbreekt of is leeg.'); return
    }

    setSaving(true)
    const supabase = createClient()

    const { data, error: dbErr } = await supabase
      .from('vh_questionnaire')
      .insert({
        slug: parsed.id.trim(),
        title: parsed.title.trim(),
        status: parsed.status ?? 'active',
        json_content: parsed,
      })
      .select('id')
      .single()

    if (dbErr) {
      setError(dbErr.code === '23505'
        ? `Er bestaat al een vragenlijst met id "${parsed.id}".`
        : dbErr.message)
      setSaving(false)
      return
    }

    router.push(`/vragenlijsten/${data.id}`)
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
            rows={16}
            placeholder={EXAMPLE}
            required
            className="w-full rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5 text-sm font-mono text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y"
          />
        </div>

        <div className="rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-3 text-xs text-[#64748b] space-y-1">
          <p className="font-medium text-[#1e293b]">Ondersteunde vraagtypen:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li><span className="font-mono">radio</span> — keuzevraag (opties vereist)</li>
            <li><span className="font-mono">number</span> — getal</li>
            <li><span className="font-mono">long_text</span> — vrije tekst</li>
            <li><span className="font-mono">rating_10</span> — 1–10 schaal (ondersteunt leftLabel/rightLabel/category)</li>
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
        Vragenlijst importeren
      </Button>
    </form>
  )
}
