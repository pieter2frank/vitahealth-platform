'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Loader2, AlertTriangle, ScanLine } from 'lucide-react'
import Image from 'next/image'

export default function MfaEnrollPage() {
  const router = useRouter()

  const [qrCode,    setQrCode]    = useState<string | null>(null)
  const [secret,    setSecret]    = useState<string | null>(null)
  const [factorId,  setFactorId]  = useState<string | null>(null)
  const [code,      setCode]      = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [enrolling, setEnrolling] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // 2FA-factor aanmaken en QR-code ophalen
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'Vita Health' }).then(({ data, error }) => {
      if (error || !data) {
        setError('Instellen mislukt. Probeer opnieuw of neem contact op met de beheerder.')
      } else {
        setQrCode(data.totp.qr_code)
        setSecret(data.totp.secret)
        setFactorId(data.id)
      }
      setEnrolling(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    })
  }, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.replace(/\s/g, '')
    if (trimmed.length !== 6) { setError('Voer een 6-cijferige code in.'); return }
    if (!factorId) return

    setLoading(true)
    setError('')
    const supabase = createClient()

    const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
    if (challengeErr || !challenge) {
      setError('Challenge aanmaken mislukt. Ververs de pagina en probeer opnieuw.')
      setLoading(false)
      return
    }

    const { error: verifyErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: trimmed,
    })

    if (verifyErr) {
      setError('Onjuiste code. Scan de QR-code opnieuw en probeer het nogmaals.')
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
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm space-y-6">
          <div className="text-center">
            <div className="inline-flex rounded-full bg-[#eef4ff] p-3 mb-4">
              <ShieldCheck size={24} className="text-[#1f1683]" />
            </div>
            <h1 className="text-xl font-semibold text-[#1e293b] mb-1">
              Twee-factor authenticatie instellen
            </h1>
            <p className="text-sm text-[#94a3b8]">
              Voor jouw account is 2FA verplicht. Stel het eenmalig in.
            </p>
          </div>

          {enrolling && (
            <div className="flex justify-center py-8">
              <Loader2 size={24} className="animate-spin text-[#1f1683]" />
            </div>
          )}

          {!enrolling && qrCode && (
            <>
              {/* Stap 1 */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Stap 1 — Scan de QR-code
                </p>
                <div className="flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="2FA QR-code" className="rounded-lg border border-[#e2e8f0] w-44 h-44" />
                </div>
                <p className="text-xs text-center text-[#64748b]">
                  Gebruik <strong>Google Authenticator</strong>, <strong>Authy</strong> of een andere TOTP-app.
                </p>
                {secret && (
                  <details className="text-center">
                    <summary className="cursor-pointer text-xs text-[#94a3b8] hover:text-[#64748b]">
                      Geen camera? Handmatige code tonen
                    </summary>
                    <p className="mt-2 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] px-3 py-2 font-mono text-xs text-[#1e293b] break-all select-all">
                      {secret}
                    </p>
                  </details>
                )}
              </div>

              {/* Stap 2 */}
              <form onSubmit={handleVerify} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Stap 2 — Bevestig met de code uit de app
                </p>
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
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                  {loading ? 'Instellen…' : '2FA activeren'}
                </button>
              </form>
            </>
          )}

          {!enrolling && !qrCode && error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-[#94a3b8]">
          Problemen? Neem contact op met de beheerder.
        </p>
      </div>
    </div>
  )
}
