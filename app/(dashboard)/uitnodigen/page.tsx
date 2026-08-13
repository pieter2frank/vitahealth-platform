'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Send, Copy, Check } from 'lucide-react'

export default function UitnodigingPage() {
  const [form, setForm]       = useState({ first_name: '', last_name: '', email: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState<{ name: string; email: string; intakeUrl: string } | null>(null)
  const [copied, setCopied]   = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const supabase = createClient()

    // 1. Minimale cliëntrecord aanmaken — via de server route (schrijft oude
    //    kolommen + PII-kluis; de browser kan niet versleutelen).
    const createRes = await fetch('/api/clients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.first_name.trim(),
        lastName:  form.last_name.trim(),
        email:     form.email.trim().toLowerCase(),
      }),
    })
    const client = await createRes.json().catch(() => ({}))

    if (!createRes.ok || !client.id) {
      setError(client.error ?? 'Cliënt aanmaken mislukt.')
      setSaving(false)
      return
    }

    // 2. Uitnodigingsmail sturen (API route maakt ook token aan)
    const res  = await fetch('/api/email/uitnodiging', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientId: client.id }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'E-mail versturen mislukt.')
      setSaving(false)
      return
    }

    // 3. Haal de intake-URL op voor de kopieerknop
    const { data: tokenRow } = await supabase
      .from('vh_intake_token')
      .select('token')
      .eq('client_id', client.id)
      .maybeSingle()

    const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''
    const intakeUrl = tokenRow?.token
      ? `${portalUrl}/portal/aanmelden?token=${tokenRow.token}`
      : portalUrl

    setDone({ name: `${form.first_name.trim()} ${form.last_name.trim()}`, email: form.email.trim(), intakeUrl })
    setSaving(false)
  }

  async function copyLink() {
    if (!done) return
    await navigator.clipboard.writeText(done.intakeUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Bevestigingsscherm ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-[#1e293b] mb-1">Uitnodiging verstuurd!</h2>
          <p className="text-sm text-[#64748b] mb-6">
            <span className="font-medium text-[#1e293b]">{done.name}</span> ({done.email}) heeft een
            uitnodiging ontvangen met een persoonlijke intakelink.
          </p>

          {/* Link kopiëren */}
          <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 mb-6">
            <p className="text-xs text-[#64748b] mb-2 text-left">Persoonlijke intakelink (als backup):</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-[#475569] truncate">{done.intakeUrl}</code>
              <button
                onClick={copyLink}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#64748b] hover:border-[#1f1683] hover:text-[#1f1683] transition-colors"
              >
                {copied ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
              </button>
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              onClick={() => { setDone(null); setForm({ first_name: '', last_name: '', email: '' }) }}
              variant="outline"
            >
              Nog een uitnodiging
            </Button>
            <Link
              href="/clienten"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
            >
              Naar cliënten
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulier ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/clienten" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar cliënten
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Uitnodiging versturen</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          De uitgenodigde ontvangt een e-mail met een persoonlijke link naar het aanmeldformulier.
          Adres- en gezondheidsgegevens vult de cliënt zelf in.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-xl border border-[#e2e8f0] bg-white p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Voornaam"
            value={form.first_name}
            onChange={e => set('first_name', e.target.value)}
            required
            autoFocus
            placeholder="Jan"
          />
          <Input
            label="Achternaam"
            value={form.last_name}
            onChange={e => set('last_name', e.target.value)}
            required
            placeholder="de Vries"
          />
        </div>
        <Input
          label="E-mailadres"
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          required
          placeholder="jan@voorbeeld.nl"
        />

        {error && (
          <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={saving} size="lg" className="gap-2">
            <Send size={14} />
            Uitnodiging versturen
          </Button>
          <Link
            href="/clienten"
            className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:border-[#1f1683] hover:text-[#1f1683] transition-colors"
          >
            Annuleren
          </Link>
        </div>
      </form>
    </div>
  )
}
