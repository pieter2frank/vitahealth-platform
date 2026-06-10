'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import Image from 'next/image'

const RULES = [
  { id: 'length',  label: 'Minimaal 12 tekens',            test: (p: string) => p.length >= 12 },
  { id: 'upper',   label: 'Minimaal 1 hoofdletter',         test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Minimaal 1 kleine letter',       test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: 'Minimaal 1 cijfer',              test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Minimaal 1 speciaal teken (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(p) },
]

export default function WachtwoordHerstellenPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [sessionOk, setSessionOk] = useState(false)
  const [linkError, setLinkError] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'invalid_link') {
      setLinkError(true)
      return
    }
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        setSessionOk(true)
      }
    })
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
    if (updateErr) { setError(updateErr.message); setSaving(false); return }

    // Dashboard dwingt vervolgens 2FA-verificatie af
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo.svg" alt="Vita Health" width={140} height={44} priority />
        </div>

        <div className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm p-8">
          <h1 className="text-xl font-bold text-[#1e293b] mb-1">Nieuw wachtwoord instellen</h1>
          <p className="text-sm text-[#64748b] mb-6">Kies een sterk nieuw wachtwoord voor je account.</p>

          {linkError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
              Deze herstellink is ongeldig of verlopen. Vraag een nieuwe via &ldquo;Wachtwoord vergeten&rdquo;.
            </div>
          ) : !sessionOk && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 mb-4">
              Sessie laden… Klik de link in je e-mail opnieuw als dit niet verdwijnt.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Nieuw wachtwoord</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Kies een sterk wachtwoord"
                  className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2.5 pr-10 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 focus:border-[#1f1683]"
                  required
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && (
                <ul className="mt-2.5 space-y-1">
                  {RULES.map(r => {
                    const ok = r.test(password)
                    return (
                      <li key={r.id} className="flex items-center gap-1.5 text-xs">
                        {ok ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                            : <XCircle size={13} className="text-[#94a3b8] shrink-0" />}
                        <span className={ok ? 'text-emerald-700' : 'text-[#94a3b8]'}>{r.label}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1e293b] mb-1.5">Wachtwoord bevestigen</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Herhaal wachtwoord"
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/20 ${
                  confirm.length > 0 ? (matching ? 'border-emerald-400' : 'border-red-300') : 'border-[#e2e8f0] focus:border-[#1f1683]'
                }`}
                required
              />
              {confirm.length > 0 && !matching && (
                <p className="text-xs text-red-500 mt-1">Wachtwoorden komen niet overeen.</p>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{error}</div>
            )}

            <button
              type="submit"
              disabled={saving || !allValid || !matching || !sessionOk}
              className="w-full rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Opslaan…' : 'Wachtwoord opslaan'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
