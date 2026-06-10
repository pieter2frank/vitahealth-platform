'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanLine, Loader2, AlertTriangle } from 'lucide-react'

export function KitScanSearch() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Direct focus zodat je meteen kunt inscannen
  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const barcode = code.trim()
    if (!barcode) return

    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data } = await supabase
      .from('vh_testkit')
      .select('id')
      .eq('barcode', barcode)
      .maybeSingle()

    setLoading(false)

    if (data?.id) {
      router.push(`/testkits/${data.id}`)
    } else {
      setError(`Geen testkit gevonden met barcode "${barcode}".`)
      setCode('')
      inputRef.current?.focus()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#1f1683]/20 focus-within:border-[#1f1683]">
        <ScanLine size={18} className="text-[#94a3b8] shrink-0" />
        <input
          ref={inputRef}
          value={code}
          onChange={e => { setCode(e.target.value); setError('') }}
          placeholder="Scan een barcode of typ deze in en druk op Enter…"
          className="flex-1 bg-transparent text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none"
          autoComplete="off"
        />
        {loading && <Loader2 size={16} className="animate-spin text-[#1f1683] shrink-0" />}
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
          <AlertTriangle size={14} className="shrink-0" />
          {error}
        </p>
      )}
    </form>
  )
}
