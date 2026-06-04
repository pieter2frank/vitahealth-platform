'use client'
import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Clock, Lock } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [blocked,  setBlocked]  = useState(false)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  const inactief = params.get('reden') === 'inactiviteit'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (blocked || lockedUntil) return
    setLoading(true)
    setError('')

    const res  = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    })
    const json = await res.json()

    if (json.ok) {
      router.push(params.get('redirect') ?? '/dashboard')
      router.refresh()
    } else {
      setError(json.error ?? 'Inloggen mislukt.')
      if (json.blocked)     setBlocked(true)
      if (json.lockedUntil) setLockedUntil(json.lockedUntil)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {inactief && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <Clock size={14} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700">
            Je bent automatisch uitgelogd wegens 5 minuten inactiviteit.
          </p>
        </div>
      )}
      <Input
        label="E-mailadres"
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="naam@vita-health.nl"
        required
        autoComplete="email"
      />
      <Input
        label="Wachtwoord"
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="••••••••"
        required
        autoComplete="current-password"
      />
      {blocked && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <Lock size={14} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {!blocked && lockedUntil && (
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2.5">
          <Clock size={14} className="text-orange-600 shrink-0 mt-0.5" />
          <p className="text-sm text-orange-700">{error}</p>
        </div>
      )}
      {!blocked && !lockedUntil && error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={loading}
        disabled={blocked || !!lockedUntil}
      >
        Inloggen
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image src="/logo.svg" alt="Vita Health" width={180} height={55} priority />
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold text-[#1e293b]">Inloggen</h1>
          <p className="mb-6 text-sm text-[#94a3b8]">Medewerkers portaal</p>
          <Suspense fallback={<div className="h-48" />}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-[#94a3b8]">
          Wachtwoord vergeten? Neem contact op met de beheerder.
        </p>
      </div>
    </div>
  )
}
