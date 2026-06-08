'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle, GripVertical } from 'lucide-react'

interface Props {
  activeVersion:   number
  initialRequired: string[]
  initialOptional: string[]
}

export function ConsentEditor({ activeVersion, initialRequired, initialOptional }: Props) {
  const router = useRouter()
  const [required, setRequired] = useState<string[]>(initialRequired)
  const [optional, setOptional] = useState<string[]>(initialOptional)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<number | null>(null)

  const dirty =
    JSON.stringify(required) !== JSON.stringify(initialRequired) ||
    JSON.stringify(optional) !== JSON.stringify(initialOptional)

  function updateItem(list: 'req' | 'opt', i: number, value: string) {
    setDone(null)
    if (list === 'req') setRequired(prev => prev.map((t, idx) => idx === i ? value : t))
    else                setOptional(prev => prev.map((t, idx) => idx === i ? value : t))
  }
  function removeItem(list: 'req' | 'opt', i: number) {
    setDone(null)
    if (list === 'req') setRequired(prev => prev.filter((_, idx) => idx !== i))
    else                setOptional(prev => prev.filter((_, idx) => idx !== i))
  }
  function addItem(list: 'req' | 'opt') {
    setDone(null)
    if (list === 'req') setRequired(prev => [...prev, ''])
    else                setOptional(prev => [...prev, ''])
  }

  async function publish() {
    setError('')
    const req = required.map(t => t.trim()).filter(Boolean)
    const opt = optional.map(t => t.trim()).filter(Boolean)
    if (req.length === 0) { setError('Er moet minimaal één verplichte toestemming zijn.'); return }

    setSaving(true)
    const res = await fetch('/api/admin/consents', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ required: req, optional: opt }),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error ?? 'Publiceren mislukt.'); return }
    setDone(json.version)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg bg-[#eef4ff] border border-[#c7d7fd] px-4 py-2.5">
        <span className="text-sm text-[#1f1683]">
          Huidige actieve versie: <strong>v{activeVersion}</strong>
        </span>
        {dirty && <span className="text-xs text-amber-700">Niet-gepubliceerde wijzigingen</span>}
      </div>

      {/* Verplichte toestemmingen */}
      <ConsentList
        title="Verplichte toestemmingen"
        hint="Cliënt moet deze allemaal aanvinken om door te gaan."
        items={required}
        list="req"
        onUpdate={updateItem}
        onRemove={removeItem}
        onAdd={() => addItem('req')}
      />

      {/* Optionele toestemmingen */}
      <ConsentList
        title="Optionele toestemmingen"
        hint="Cliënt mag deze aanvinken, maar het is niet verplicht."
        items={optional}
        list="opt"
        onUpdate={updateItem}
        onRemove={removeItem}
        onAdd={() => addItem('opt')}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {done !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
          <CheckCircle2 size={14} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700">Gepubliceerd als versie v{done}. Nieuwe aanmeldingen gebruiken nu deze teksten.</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={publish}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
          Publiceren als nieuwe versie
        </button>
        {!dirty && <span className="text-xs text-[#94a3b8]">Wijzig eerst een tekst om te kunnen publiceren.</span>}
      </div>
    </div>
  )
}

function ConsentList({
  title, hint, items, list, onUpdate, onRemove, onAdd,
}: {
  title: string
  hint: string
  items: string[]
  list: 'req' | 'opt'
  onUpdate: (list: 'req' | 'opt', i: number, value: string) => void
  onRemove: (list: 'req' | 'opt', i: number) => void
  onAdd: () => void
}) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
      <div className="border-b border-[#f1f5f9] px-4 py-3 bg-[#f8fafc]">
        <p className="text-sm font-semibold text-[#1e293b]">{title}</p>
        <p className="text-xs text-[#94a3b8] mt-0.5">{hint}</p>
      </div>
      <div className="p-4 space-y-3">
        {items.length === 0 && (
          <p className="text-sm text-[#94a3b8] text-center py-2">Nog geen toestemmingen.</p>
        )}
        {items.map((text, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center text-[#cbd5e1] mt-1.5">
              <GripVertical size={14} />
            </div>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#eef4ff] text-xs font-semibold text-[#1f1683] mt-1.5">
              {i + 1}
            </span>
            <textarea
              value={text}
              onChange={e => onUpdate(list, i, e.target.value)}
              rows={2}
              placeholder="Toestemmingstekst…"
              className="flex-1 rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683] resize-y"
            />
            <button
              onClick={() => onRemove(list, i)}
              title="Verwijderen"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#94a3b8] hover:bg-red-50 hover:text-red-600 transition-colors mt-1"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#cbd5e1] px-3 py-2 text-sm font-medium text-[#64748b] hover:border-[#1f1683] hover:text-[#1f1683] transition-colors"
        >
          <Plus size={14} />
          Toestemming toevoegen
        </button>
      </div>
    </div>
  )
}
