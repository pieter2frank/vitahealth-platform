'use client'
import { useState } from 'react'
import { Copy, Check, Loader2, AlertTriangle } from 'lucide-react'

export function CopyIntakeLink({ clientId }: { clientId: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')
  const [error, setError] = useState('')

  async function handleCopy() {
    setState('loading'); setError('')
    try {
      const res = await fetch(`/api/clienten/${clientId}/intake-link`)
      const json = await res.json()
      if (!res.ok || !json.url) { setState('error'); setError(json.error ?? 'Link ophalen mislukt.'); return }
      await navigator.clipboard.writeText(json.url)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error'); setError('Kopiëren naar klembord mislukt.')
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
      <button
        type="button"
        onClick={handleCopy}
        disabled={state === 'loading'}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#1f1683] hover:bg-[#eef4ff] transition-colors disabled:opacity-50"
      >
        {state === 'loading' ? <Loader2 size={14} className="animate-spin" />
          : state === 'copied' ? <Check size={14} className="text-emerald-600" />
          : <Copy size={14} />}
        {state === 'copied' ? 'Gekopieerd!' : 'Link naar intake kopiëren'}
      </button>
      {state === 'error' && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle size={12} /> {error}
        </p>
      )}
    </div>
  )
}
