'use client'
import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Onjuist e-mailadres of wachtwoord.')
      setLoading(false)
    } else {
      router.push(params.get('redirect') ?? '/dashboard')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" size="lg" loading={loading}>
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
