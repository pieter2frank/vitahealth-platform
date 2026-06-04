'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import Image from 'next/image'

// Wachtwoordeisen
const RULES = [
  { id: 'length',  label: 'Minimaal 12 tekens',           test: (p: string) => p.length >= 12 },
  { id: 'upper',   label: 'Minimaal 1 hoofdletter',        test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Minimaal 1 kleine letter',      test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'Minimaal 1 cijfer',             test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Minimaal 1 speciaal teken (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(p) },
]

export default function InviteAcceptPage() {
  const router = useRouter()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [sessionOk, setSessionOk] = useState(false)

  // Supabase verwerkt de hash-tokens automatisch wanneer de pagina laadt
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setSessionOk(true)
      }
    })
    // Trigger sessie-check
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionOk(true)
    })
  }, [])

  const allValid = RULES.every(r => r.test(password))
  const matching = password === confirm && confirm.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!allValid) { setError('Wachtwoord voldoet niet aan alle eisen.'); return }
    if (!matching)  { setError('Wachtwoorden komen niet overeen.'); return }

    setSaving(true)
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    // Doorsturen naar dashboard — MFA-enrollment wordt afgedwongen door layout
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo.svg" alt="Vita Health" width={140} height={44} priority />
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8">
          <h1 className="text-xl font-bold text-[#1e293b] mb-1">Account instellen</h1>
          <p className="text-sm text-[#64748b] mb-6">
            Kies een sterk wachtwoord. Daarna stel je de authenticator-app in voor 2FA.
          </p>

          {!sessionOk && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-4">
              Sessie laden… Klik de link in je e-mail opnieuw als dit niet verdwijnt.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Wachtwoord */}
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">
                Wachtwoord
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Kies een sterk wachtwoord"
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 pr-10 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Wachtwoordeisen */}
              {password.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {RULES.map(r => {
                    const ok = r.test(password)
                    return (
                      <li key={r.id} className="flex items-center gap-1.5 text-xs">
                        {ok
                          ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                          : <XCircle     size={13} className="text-[#94a3b8]    shrink-0" />
                        }
                        <span className={ok ? 'text-emerald-700' : 'text-[#94a3b8]'}>{r.label}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Bevestigen */}
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">
                Wachtwoord bevestigen
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Herhaal wachtwoord"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 ${
                  confirm.length > 0
                    ? matching ? 'border-emerald-400' : 'border-red-300'
                    : 'border-[#e2e8f0] focus:border-[#1f1683]'
                }`}
                required
              />
              {confirm.length > 0 && !matching && (
                <p className="text-xs text-red-500 mt-1">Wachtwoorden komen niet overeen.</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !allValid || !matching || !sessionOk}
              className="w-full rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Opslaan…' : 'Wachtwoord instellen & doorgaan →'}
            </button>
          </form>

          {/* Instructies authenticator */}
          <div className="mt-6 rounded-lg bg-[#f8fafc] border border-[#e2e8f0] p-4">
            <p className="text-xs font-semibold text-[#475569] mb-2">Volgende stap: authenticator-app</p>
            <p className="text-xs text-[#64748b] leading-relaxed">
              Na het instellen van je wachtwoord wordt je gevraagd een authenticator-app te koppelen.
              Zorg dat je <strong>Google Authenticator</strong> of <strong>Microsoft Authenticator</strong> op je telefoon hebt geïnstalleerd.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
