'use client'
import { useState, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft } from 'lucide-react'
import type { QuestionnaireQuestion } from '@/types'

// ─── Constanten ───────────────────────────────────────────────────────────────

const REQUIRED_CONSENTS = [
  'Ik heb de deelnemersinformatie gelezen en begrepen.',
  'Ik heb voldoende gelegenheid gehad om vragen te stellen.',
  'Mijn vragen zijn naar tevredenheid beantwoord.',
  'Ik begrijp dat deelname vrijwillig is.',
  'Ik begrijp dat ik mijn deelname op elk moment mag stoppen.',
  'Ik geef toestemming om deel te nemen aan de Vita Health biomarkertest dry-run.',
  'Ik geef toestemming voor het verwerken van mijn persoonsgegevens en gezondheidsgegevens voor de uitvoering van deze dry-run.',
  'Ik geef toestemming om mijn noodzakelijke gegevens en samplecode te delen met Nightingale Health voor analyse van mijn sample.',
  'Ik geef toestemming dat Vita Health mijn testresultaten ontvangt via beveiligde gegevensoverdracht.',
  'Ik geef toestemming dat mijn resultaten worden beoordeeld door een medisch deskundige voordat ik terugkoppeling ontvang.',
  'Ik geef toestemming dat Vita Health contact met mij opneemt over mijn deelname, de sample-afname, mijn uitslag en eventuele vervolgstappen.',
  'Ik verklaar dat ik de gezondheidsvragenlijst volledig en naar waarheid invul.',
  'Ik begrijp dat de test geen diagnose stelt en geen vervanging is van reguliere medische zorg.',
  'Ik begrijp dat ik bij medische klachten altijd zelf contact moet opnemen met mijn huisarts of, bij spoed, met de huisartsenpost of 112.',
]

const OPTIONAL_CONSENTS = [
  'Ik geef toestemming dat mijn niet-herleidbare feedback en procesgegevens worden gebruikt om het proces te verbeteren voor een grotere pilot.',
  'Ik geef toestemming dat Vita Health mij na afloop benadert voor feedback over mijn ervaring met de biomarkertest.',
  'Ik geef toestemming dat mijn gegevens, uitsluitend in gepseudonimiseerde of geaggregeerde vorm, worden gebruikt voor evaluatie van de dry-run.',
]

const STEPS = [
  { label: 'Persoonsgegevens' },
  { label: 'Adresgegevens' },
  { label: 'Toestemmingen' },
  { label: 'Vragenlijst' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  intakeQuestionnaire: { id: string; title: string; questions: QuestionnaireQuestion[] } | null
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EnrollmentForm({ intakeQuestionnaire }: Props) {
  const totalSteps = intakeQuestionnaire ? 4 : 3
  const [step, setStep]     = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(false)

  // Persoonsgegevens
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [birthDate,  setBirthDate]  = useState('')

  // Adresgegevens
  const [address,    setAddress]    = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city,       setCity]       = useState('')

  // Toestemmingen
  const [required, setRequired] = useState<boolean[]>(Array(REQUIRED_CONSENTS.length).fill(false))
  const [optional, setOptional] = useState<boolean[]>(Array(OPTIONAL_CONSENTS.length).fill(false))

  // Vragenlijst
  const [responses, setResponses] = useState<Record<string, string | number | null>>({})
  const [qErrors, setQErrors]     = useState<Set<string>>(new Set())

  // IDs opgeslagen na stap 2 / stap 3
  const [clientId,    setClientId]    = useState<string | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)

  // ─── Validatie ──────────────────────────────────────────────────────────────

  function validateStep1(): string | null {
    if (!firstName.trim()) return 'Voornaam is verplicht.'
    if (!lastName.trim())  return 'Achternaam is verplicht.'
    if (!email.trim() || !email.includes('@')) return 'Voer een geldig e-mailadres in.'
    return null
  }

  function validateStep2(): string | null {
    if (!address.trim())    return 'Adres is verplicht.'
    if (!postalCode.trim()) return 'Postcode is verplicht.'
    if (!city.trim())       return 'Plaatsnaam is verplicht.'
    return null
  }

  function validateStep3(): string | null {
    if (!required.every(Boolean)) return 'Bevestig alle verplichte toestemmingen om verder te gaan.'
    return null
  }

  // ─── Navigatie ──────────────────────────────────────────────────────────────

  function handleBack() {
    setError('')
    setStep(s => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleNext() {
    setError('')

    // Stap 1 → 2: alleen valideren
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }
      setStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Stap 2 → 3: vh_client aanmaken
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }

      setSaving(true)
      const supabase = createClient()

      const { data: newClient, error: insertErr } = await supabase
        .from('vh_client')
        .insert({
          first_name:        firstName.trim(),
          last_name:         lastName.trim(),
          email:             email.trim(),
          phone:             phone.trim() || null,
          birth_date:        birthDate || null,
          address:           address.trim(),
          postal_code:       postalCode.trim(),
          city:              city.trim(),
          enrollment_status: 'aangemeld',
        })
        .select('id')
        .single()

      setSaving(false)

      if (insertErr || !newClient) {
        setError('Registratie mislukt: ' + (insertErr?.message ?? 'onbekende fout'))
        return
      }

      setClientId(newClient.id)
      setStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Stap 3 → 4 (of afronden als geen vragenlijst): toestemmingen opslaan
    if (step === 3) {
      const err = validateStep3()
      if (err) { setError(err); return }

      if (!clientId) { setError('Clientid ontbreekt.'); return }

      setSaving(true)
      const supabase = createClient()

      // Toestemmingen opslaan
      const { error: consentErr } = await supabase
        .from('vh_consent')
        .insert({ client_id: clientId, required, optional })

      if (consentErr) {
        setSaving(false)
        setError('Toestemmingen opslaan mislukt: ' + consentErr.message)
        return
      }

      // Status bijwerken
      await supabase
        .from('vh_client')
        .update({ enrollment_status: 'toestemming_gegeven' })
        .eq('id', clientId)

      // Intake vragenlijst toewijzen (indien geconfigureerd)
      if (intakeQuestionnaire) {
        const { data: qa, error: qaErr } = await supabase
          .from('vh_questionnaire_assignment')
          .insert({ questionnaire_id: intakeQuestionnaire.id, client_id: clientId })
          .select('id')
          .single()

        setSaving(false)

        if (qaErr || !qa) {
          setError('Vragenlijst koppelen mislukt: ' + (qaErr?.message ?? 'onbekende fout'))
          return
        }

        setAssignmentId(qa.id)
        setStep(4)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else {
        // Geen vragenlijst → direct klaar
        setSaving(false)
        setDone(true)
      }
    }
  }

  // ─── Vragenlijst indienen (stap 4) ──────────────────────────────────────────

  async function handleSubmitQuestionnaire(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !assignmentId || !intakeQuestionnaire) return

    // Valideer verplichte vragen
    const missing = new Set<string>()
    for (const q of intakeQuestionnaire.questions) {
      if (q.required) {
        const val = responses[q.id]
        if (val === undefined || val === null || val === '') missing.add(q.id)
      }
    }
    if (missing.size > 0) {
      setQErrors(missing)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    setError('')
    const supabase = createClient()

    const { error: respErr } = await supabase
      .from('vh_questionnaire_response')
      .insert({
        assignment_id:    assignmentId,
        questionnaire_id: intakeQuestionnaire.id,
        client_id:        clientId,
        responses,
      })

    if (respErr) { setError(respErr.message); setSaving(false); return }

    await supabase
      .from('vh_questionnaire_assignment')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', assignmentId)

    await supabase
      .from('vh_client')
      .update({ enrollment_status: 'vragenlijst_ingevuld' })
      .eq('id', clientId)

    setSaving(false)
    setDone(true)
  }

  // ─── Klaar ────────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center shadow-sm">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-green-800 mb-2">Aanmelding ontvangen!</h2>
        <p className="text-sm text-green-700 leading-relaxed max-w-xs mx-auto">
          Bedankt voor je aanmelding, {firstName}. Een medewerker van Vita Health neemt contact met je op
          over de verdere stappen.
        </p>
      </div>
    )
  }

  // ─── Stap-indicator ───────────────────────────────────────────────────────────

  const visibleSteps = intakeQuestionnaire ? STEPS : STEPS.slice(0, 3)

  return (
    <div>
      {/* Stap-indicator */}
      <div className="flex items-start mb-8">
        {visibleSteps.map((s, i) => {
          const n        = i + 1
          const active   = step === n
          const complete = step > n
          const last     = i === visibleSteps.length - 1
          return (
            <Fragment key={n}>
              {/* Stap-cirkel + label */}
              <div className="flex flex-col items-center">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                  complete
                    ? 'bg-[#1f1683] border-[#1f1683] text-white'
                    : active
                      ? 'bg-white border-[#1f1683] text-[#1f1683]'
                      : 'bg-white border-[#e2e8f0] text-[#94a3b8]'
                }`}>
                  {complete ? <CheckCircle2 size={16} /> : n}
                </div>
                <span className={`mt-1.5 text-[11px] font-medium text-center leading-tight max-w-[60px] ${
                  active ? 'text-[#1f1683]' : complete ? 'text-[#64748b]' : 'text-[#94a3b8]'
                }`}>
                  {s.label}
                </span>
              </div>
              {/* Verbindingslijn */}
              {!last && (
                <div className={`flex-1 h-0.5 mt-4 transition-colors ${complete ? 'bg-[#1f1683]' : 'bg-[#e2e8f0]'}`} />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* Formulier */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">

        {/* ── Stap 1: Persoonsgegevens ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#1e293b]">Persoonsgegevens</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Voornaam" required>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Jan" className={INPUT} />
              </Field>
              <Field label="Achternaam" required>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Jansen" className={INPUT} />
              </Field>
            </div>

            <Field label="E-mailadres" required>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jan@voorbeeld.nl" className={INPUT} />
            </Field>

            <Field label="Telefoonnummer">
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+31 6 12345678" className={INPUT} />
            </Field>

            <Field label="Geboortedatum">
              <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={INPUT} />
            </Field>
          </div>
        )}

        {/* ── Stap 2: Adresgegevens ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#1e293b]">Adresgegevens</h2>

            <Field label="Straat en huisnummer" required>
              <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Voorbeeldstraat 1" className={INPUT} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Postcode" required>
                <input value={postalCode} onChange={e => setPostalCode(e.target.value)} placeholder="1234 AB" className={INPUT} />
              </Field>
              <Field label="Plaatsnaam" required>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Amsterdam" className={INPUT} />
              </Field>
            </div>
          </div>
        )}

        {/* ── Stap 3: Toestemmingen ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-[#1e293b]">Toestemmingen</h2>

            {/* Verplichte toestemmingen */}
            <div>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">
                Verplichte toestemmingen — alle vinkjes zijn nodig om deel te nemen
              </p>
              <div className="space-y-2.5">
                {REQUIRED_CONSENTS.map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={required[i]}
                      onChange={e => {
                        const next = [...required]
                        next[i] = e.target.checked
                        setRequired(next)
                        setError('')
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-[#d1d5db] accent-[#1f1683] shrink-0"
                    />
                    <span className="text-sm text-[#374151] leading-relaxed group-hover:text-[#1e293b]">{text}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Optionele toestemmingen */}
            <div className="border-t border-[#f1f5f9] pt-4">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">
                Optionele toestemmingen
              </p>
              <div className="space-y-2.5">
                {OPTIONAL_CONSENTS.map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={optional[i]}
                      onChange={e => {
                        const next = [...optional]
                        next[i] = e.target.checked
                        setOptional(next)
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-[#d1d5db] accent-[#1f1683] shrink-0"
                    />
                    <span className="text-sm text-[#374151] leading-relaxed group-hover:text-[#1e293b]">{text}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stap 4: Intake vragenlijst ──────────────────────────────────────── */}
        {step === 4 && intakeQuestionnaire && (
          <form onSubmit={handleSubmitQuestionnaire} className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-[#1e293b]">{intakeQuestionnaire.title}</h2>
            <p className="text-sm text-[#64748b]">
              Beantwoord onderstaande vragen zo volledig mogelijk. Vragen met * zijn verplicht.
            </p>

            {qErrors.size > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-600">
                  {qErrors.size} verplichte {qErrors.size === 1 ? 'vraag is' : 'vragen zijn'} nog niet beantwoord.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {intakeQuestionnaire.questions.map(q => {
                const hasError = qErrors.has(q.id)
                return (
                  <div key={q.id} className={`rounded-xl border p-4 ${hasError ? 'border-red-200 bg-red-50' : 'border-[#e2e8f0] bg-[#f8fafc]'}`}>
                    <p className={`text-sm font-medium mb-3 ${hasError ? 'text-red-700' : 'text-[#1e293b]'}`}>
                      {q.label}
                      {q.required && <span className="text-red-400 ml-0.5">*</span>}
                    </p>

                    {/* RADIO */}
                    {q.type === 'radio' && q.options && (
                      <div className="space-y-2">
                        {q.options.map(opt => (
                          <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.value}
                              checked={responses[q.id] === opt.value}
                              onChange={() => {
                                setResponses(prev => ({ ...prev, [q.id]: opt.value }))
                                setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                              }}
                              className="h-4 w-4 accent-[#1f1683] shrink-0"
                            />
                            <span className="text-sm text-[#1e293b]">{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    )}

                    {/* NUMBER */}
                    {q.type === 'number' && (
                      <input
                        type="number"
                        value={responses[q.id] ?? ''}
                        onChange={e => {
                          setResponses(prev => ({ ...prev, [q.id]: e.target.value === '' ? null : Number(e.target.value) }))
                          setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                        }}
                        className={`h-10 w-full max-w-[180px] rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] ${hasError ? 'border-red-300' : 'border-[#e2e8f0] bg-white'}`}
                      />
                    )}

                    {/* LONG TEXT */}
                    {q.type === 'long_text' && (
                      <textarea
                        value={(responses[q.id] as string) ?? ''}
                        onChange={e => {
                          setResponses(prev => ({ ...prev, [q.id]: e.target.value }))
                          setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                        }}
                        rows={3}
                        className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y ${hasError ? 'border-red-300' : 'border-[#e2e8f0] bg-white'}`}
                      />
                    )}

                    {/* RATING 1–10 */}
                    {q.type === 'rating_10' && (
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {q.leftLabel && <span className="text-xs text-[#94a3b8]">{q.leftLabel}</span>}
                        <div className="flex gap-1.5 flex-wrap">
                          {[1,2,3,4,5,6,7,8,9,10].map(n => {
                            const selected = responses[q.id] === n
                            return (
                              <button
                                key={n}
                                type="button"
                                onClick={() => {
                                  setResponses(prev => ({ ...prev, [q.id]: n }))
                                  setQErrors(prev => { const s = new Set(prev); s.delete(q.id); return s })
                                }}
                                className={`h-10 w-10 rounded-lg border text-sm font-medium transition-all ${
                                  selected
                                    ? 'bg-[#1f1683] text-white border-[#1f1683] scale-105'
                                    : hasError
                                      ? 'border-red-200 bg-red-50 text-red-600 hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                      : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683] hover:bg-[#eef4ff] hover:text-[#1f1683]'
                                }`}
                              >
                                {n}
                              </button>
                            )
                          })}
                        </div>
                        {q.rightLabel && <span className="text-xs text-[#94a3b8]">{q.rightLabel}</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {error && <ErrorBanner message={error} />}

            <div className="flex items-center justify-between pt-2">
              <button type="button" onClick={handleBack} className={BTN_SECONDARY}>
                <ChevronLeft size={16} /> Terug
              </button>
              <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Opslaan…' : 'Aanmelding afronden'}
                {!saving && <CheckCircle2 size={15} />}
              </button>
            </div>
          </form>
        )}

        {/* ── Foutmelding + navigatiebuttons (stap 1–3) ──────────────────────── */}
        {step <= 3 && (
          <div className="border-t border-[#f1f5f9] px-6 py-4 space-y-3">
            {error && <ErrorBanner message={error} />}
            <div className="flex items-center justify-between">
              {step > 1 ? (
                <button onClick={handleBack} className={BTN_SECONDARY}>
                  <ChevronLeft size={16} /> Terug
                </button>
              ) : (
                <div />
              )}
              <button onClick={handleNext} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Bezig…' : step === 3 && !intakeQuestionnaire ? 'Aanmelding afronden' : 'Volgende'}
                {!saving && step < totalSteps && <ChevronRight size={16} />}
                {!saving && (step === 3 && !intakeQuestionnaire) && <CheckCircle2 size={15} />}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Kleine helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748b] mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
      <AlertTriangle size={14} className="text-red-500 shrink-0" />
      <p className="text-sm text-red-600">{message}</p>
    </div>
  )
}

const INPUT = 'h-10 w-full rounded-lg border border-[#e2e8f0] bg-white px-3 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]'
const BTN_PRIMARY   = 'inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const BTN_SECONDARY = 'inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors'
