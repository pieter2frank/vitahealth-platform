'use client'
import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ArrowLeft } from 'lucide-react'

export default function WachtwoordVergetenPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/wachtwoord-reset', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    }).catch(() => {})
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image src="/logo.svg" alt="Vita Health" width={180} height={55} priority />
        </div>
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
              <h1 className="text-lg font-semibold text-[#1e293b]">Controleer je e-mail</h1>
              <p className="text-sm text-[#64748b] leading-relaxed">
                Als dit e-mailadres bij ons bekend is, ontvang je een link om je wachtwoord opnieuw in te stellen.
              </p>
            </div>
          ) : (
            <>
              <h1 className="mb-1 text-xl font-semibold text-[#1e293b]">Wachtwoord vergeten</h1>
              <p className="mb-6 text-sm text-[#94a3b8]">
                Vul je e-mailadres in. We sturen je een link om een nieuw wachtwoord in te stellen.
              </p>
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
                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Verstuur herstellink
                </Button>
              </form>
            </>
          )}
        </div>
        <Link
          href="/auth/login"
          className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#64748b] hover:text-[#1e293b]"
        >
          <ArrowLeft size={13} /> Terug naar inloggen
        </Link>
      </div>
    </div>
  )
}
