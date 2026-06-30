'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, CheckCircle2 } from 'lucide-react'

export function DigestEmailForm({ current }: { current: string | null }) {
  const [value,  setValue]  = useState(current ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  async function handleSave() {
    setSaving(true); setError(''); setSaved(false)
    const supabase = createClient()
    const { error: err } = await supabase.from('vh_setting').upsert({
      key:        'daily_digest_email',
      value:      value.trim() || null,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true); setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="digest-email" className="block text-sm font-medium text-[#1e293b] mb-1.5">
          Ontvanger
        </label>
        <input
          id="digest-email"
          type="email"
          value={value}
          onChange={e => { setValue(e.target.value); setSaved(false) }}
          placeholder="info@dokterchantalle.nl"
          className="w-full max-w-md rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {saving ? 'Opslaan…' : 'Opslaan'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs text-green-600">
            <CheckCircle2 size={13} /> Opgeslagen
          </span>
        )}
      </div>
    </div>
  )
}
