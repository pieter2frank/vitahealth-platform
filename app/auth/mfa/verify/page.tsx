'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

export default function MfaVerifyPage() {
  const router = useRouter()
  const [code, setCode]     = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.replace(/\s/g, '')
    if (trimmed.length !== 6) { setError('Voer een 6-cijferige code in.'); return }

    setLoading(true)
    setError('')
    const supabase = createClient()

    // Factor ophalen
    const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors()
    if (listErr || !factors?.totp?.length) {
      setError('Geen 2FA-factor gevonden. Neem contact op met de beheerder.')
      setLoading(false)
      return
    }
    const factorId = factors.totp[0].id

    // Challenge aanmaken
    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setError('Challenge aanmaken mislukt. Probeer opnieuw.')
      setLoading(false)
      return
    }

    // Code verifiëren
    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: trimmed,
    })

    if (verifyErr) {
      setError('Onjuiste code. Controleer je authenticator-app en probeer opnieuw.')
      setCode('')
      setLoading(false)
      inputRef.current?.focus()
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image src="/logo.svg" alt="Vita Health" width={180} height={55} priority />
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="rounded-full bg-[#eef4ff] p-3">
              <ShieldCheck size={24} className="text-[#1f1683]" />
            </div>
          </div>
          <h1 className="text-xl font-semibold text-[#1e293b] text-center mb-1">
            Twee-factor verificatie
          </h1>
          <p className="text-sm text-[#94a3b8] text-center mb-6">
            Voer de 6-cijferige code in uit je authenticator-app.
          </p>

          <form onSubmit={handleVerify} className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9 ]*"
              maxLength={7}
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              placeholder="000 000"
              className="h-14 w-full rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 text-center text-2xl font-mono font-bold tracking-[.4em] text-[#1e293b] placeholder:text-[#cbd5e1] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
              autoComplete="one-time-code"
            />

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.replace(/\s/g, '').length !== 6}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1683] px-4 py-3 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              {loading ? 'Verifiëren…' : 'Bevestigen'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-[#94a3b8]">
          Toegang tot je authenticator-app nodig? Neem contact op met de beheerder.
        </p>
      </div>
    </div>
  )
}
