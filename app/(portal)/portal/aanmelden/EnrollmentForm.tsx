'use client'
import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft, Info, ExternalLink } from 'lucide-react'
import type { QuestionnaireQuestion } from '@/types'
import { SCREENER_INTRO, SCREENER_CRITERIA } from '@/lib/screener'
import { DateFieldNL } from '@/components/ui/DateFieldNL'

const STEPS = [
  { label: 'Persoonsgegevens' },
  { label: 'Adresgegevens' },
  { label: 'Toestemmingen' },
  { label: 'Vragenlijst' },
]

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ResumeInfo {
  clientId:     string
  status:       string
  firstName:    string
  lastName:     string
  email:        string
  phone:        string
  birthDate:    string
  address:      string
  postalCode:   string
  city:         string
  hasAddress:   boolean
  assignmentId: string | null
  token:        string | null
  screenerChoice: 'ok' | 'hold' | null
}

interface Props {
  intakeQuestionnaire: { id: string; title: string; questions: QuestionnaireQuestion[] } | null
  initialEmail?: string
  initialResumeInfo?: ResumeInfo   // server-side opgelost via ?token=
  requiredConsents: string[]       // actieve toestemmingsteksten (DB-versie)
  optionalConsents: string[]
  consentVersion: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EnrollmentForm({
  intakeQuestionnaire, initialEmail, initialResumeInfo,
  requiredConsents, optionalConsents, consentVersion,
}: Props) {
  const totalSteps = intakeQuestionnaire ? 4 : 3
  const [step, setStep]         = useState(1)
  const [saving, setSaving]     = useState(false)
  // Screener voor stap 4: null=nog niet beantwoord, 'ok'=doorgaan, 'hold'=on hold
  const [screeningChoice, setScreeningChoice] = useState<'ok' | 'hold' | null>(null)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  // Als initialResumeInfo meegegeven is (token-link): direct banner tonen, geen check nodig
  const [resumeInfo, setResumeInfo]             = useState<ResumeInfo | null>(initialResumeInfo ?? null)
  const [checkingInitialEmail, setCheckingInitialEmail] = useState(!!initialEmail && !initialResumeInfo)
  // Bekend e-mailadres → veilige hervat-link naar het geregistreerde adres i.p.v.
  // gegevens inline tonen (voorkomt anonieme PII-/token-disclosure, zie P3-10).
  const [resumeEmailSent, setResumeEmailSent] = useState(false)

  // Persoonsgegevens
  const [firstName,  setFirstName]  = useState('')
  const [lastName,   setLastName]   = useState('')
  const [email,      setEmail]      = useState(initialEmail ?? '')
  const [phone,      setPhone]      = useState('')
  const [birthDate,  setBirthDate]  = useState('')

  // Adresgegevens
  const [address,    setAddress]    = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [city,       setCity]       = useState('')

  // Toestemmingen
  const [required, setRequired] = useState<boolean[]>(Array(requiredConsents.length).fill(false))
  const [optional, setOptional] = useState<boolean[]>(Array(optionalConsents.length).fill(false))

  // Vragenlijst
  const [responses, setResponses] = useState<Record<string, string | string[] | number | boolean | null>>({})
  const [qErrors, setQErrors]     = useState<Set<string>>(new Set())

  // IDs opgeslagen na stap 2 / stap 3
  const [clientId,    setClientId]    = useState<string | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [statusUrl,   setStatusUrl]   = useState<string | null>(null)

  // ─── Auto-check bij deep-link met ?email= ───────────────────────────────────

  useEffect(() => {
    if (!initialEmail) return
    const supabase = createClient()
    supabase.rpc('check_enrollment_email', { p_email: initialEmail.trim() }).then(async ({ data, error }) => {
      if (error) {
        console.error('[EnrollmentForm] check_enrollment_email fout:', error)
      }
      if (data?.exists) {
        // Geen inline gegevens (e-mail is niet geheim). Veilige link naar het adres.
        await fetch('/api/portal/resume-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: initialEmail.trim() }),
        }).catch(() => {})
        setResumeEmailSent(true)
      }
      setCheckingInitialEmail(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Uitgenodigde cliënt (token): direct naar stap 1 met voorgevulde data ───
  // Een net uitgenodigde cliënt (status 'aangemeld') hoeft geen hervat-banner te
  // zien — hij start meteen op stap 1 met naam en e-mail al ingevuld.
  useEffect(() => {
    if (initialResumeInfo && initialResumeInfo.status === 'aangemeld') {
      handleResume()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

    // Stap 1 → 2: valideren + e-mailadres controleren op bestaande aanmelding
    if (step === 1) {
      const err = validateStep1()
      if (err) { setError(err); return }

      // Uitgenodigde cliënt (clientId al bekend via hervatten): e-mailcheck
      // overslaan. Persisteer stap-1-gegevens meteen, zodat een reminder later
      // bij stap 2 hervat (en niet terugvalt naar stap 1).
      if (clientId) {
        setSaving(true)
        const supabase = createClient()
        await supabase
          .from('vh_client')
          .update({ phone: phone.trim() || null, birth_date: birthDate || null })
          .eq('id', clientId)
        setSaving(false)
        setStep(2)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      setSaving(true)
      const supabase = createClient()
      const { data: checkData, error: checkError } = await supabase
        .rpc('check_enrollment_email', { p_email: email.trim() })

      if (checkError) {
        console.error('[EnrollmentForm] check_enrollment_email fout:', checkError)
      }

      if (checkData?.exists) {
        // Bekend adres → veilige hervat-link mailen; geen gegevens inline tonen.
        await fetch('/api/portal/resume-link', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        }).catch(() => {})
        setSaving(false)
        setResumeEmailSent(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }

      setSaving(false)
      setStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Stap 2 → 3: vh_client aanmaken of bijwerken
    if (step === 2) {
      const err = validateStep2()
      if (err) { setError(err); return }

      setSaving(true)
      const supabase = createClient()

      const adresPayload = {
        phone:      phone.trim() || null,
        birth_date: birthDate    || null,
        address:    address.trim(),
        postal_code: postalCode.trim(),
        city:       city.trim(),
      }

      if (clientId) {
        // Uitgenodigde cliënt: bestaand record bijwerken
        const { error: updateErr } = await supabase
          .from('vh_client')
          .update(adresPayload)
          .eq('id', clientId)

        setSaving(false)
        if (updateErr) { setError('Opslaan mislukt: ' + updateErr.message); return }
      } else {
        // Nieuwe cliënt: aanmaken via SECURITY DEFINER-RPC (geen directe anon
        // insert/return op vh_client — zie migratie 059/060).
        const { data: newId, error: insertErr } = await supabase
          .rpc('portal_register_client', {
            p_first_name:  firstName.trim(),
            p_last_name:   lastName.trim(),
            p_email:       email.trim(),
            p_phone:       phone.trim() || null,
            p_birth_date:  birthDate || null,
            p_address:     address.trim(),
            p_postal_code: postalCode.trim(),
            p_city:        city.trim(),
          })

        setSaving(false)
        if (insertErr || !newId) {
          setError('Registratie mislukt: ' + (insertErr?.message ?? 'onbekende fout'))
          return
        }
        setClientId(newId as string)
      }

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
        .insert({ client_id: clientId, required, optional, consent_version: consentVersion })

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

  // ─── Intake hervatten ───────────────────────────────────────────────────────

  function handleResume() {
    if (!resumeInfo) return

    // Altijd bestaande gegevens voorinvullen
    setClientId(resumeInfo.clientId)
    setFirstName(resumeInfo.firstName)
    setLastName(resumeInfo.lastName)
    if (resumeInfo.email) setEmail(resumeInfo.email)
    setPhone(resumeInfo.phone)
    setBirthDate(resumeInfo.birthDate)
    setAddress(resumeInfo.address)
    setPostalCode(resumeInfo.postalCode)
    setCity(resumeInfo.city)

    const info = resumeInfo
    setResumeInfo(null)

    // Hervat bij de eerst-nog-te-doen stap, op basis van wat is opgeslagen.
    // Geboortedatum = kernsignaal dat stap 1 (persoonsgegevens) echt is doorlopen.
    // Een betaalde cliënt heeft al naam + adres, maar nog geen geboortedatum: die
    // start dus op stap 1 met naam/adres voorgevuld, i.p.v. stap 1-2 over te slaan.
    const consentDone    = info.status === 'toestemming_gegeven' || info.status === 'intake_on_hold'
    const personaliaDone = Boolean(info.birthDate)

    if (consentDone && info.assignmentId !== null) {
      // Toestemmingen gegeven → naar de vragenlijst (stap 4). Sla de
      // geschiktheidscheck over als die al is beantwoord.
      setAssignmentId(info.assignmentId)
      if (info.screenerChoice === 'ok') setScreeningChoice('ok')
      else if (info.screenerChoice === 'hold' || info.status === 'intake_on_hold') setScreeningChoice('hold')
      setStep(4)
    } else if (personaliaDone && info.hasAddress) {
      // Persoonsgegevens én adres al ingevuld, toestemmingen nog niet → stap 3.
      setStep(3)
    } else if (personaliaDone) {
      // Persoonsgegevens ingevuld, adres nog niet → stap 2.
      setStep(2)
    } else {
      // Nog geen geboortedatum → stap 1 (naam/e-mail/adres zijn al voorgevuld).
      setStep(1)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleStartFresh() {
    setResumeInfo(null)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── Leeftijd berekenen uit geboortedatum ───────────────────────────────────

  function calculateAge(dob: string): number {
    const birth = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  // ─── Vragenlijst indienen (stap 4) ──────────────────────────────────────────

  async function handleSubmitQuestionnaire(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !assignmentId || !intakeQuestionnaire) return

    // Valideer verplichte vragen (sla age_years-vragen over — die worden auto-berekend)
    const missing = new Set<string>()
    for (const q of intakeQuestionnaire.questions) {
      if (q.required && q.role !== 'age_years') {
        const val = responses[q.id]
        const empty = val === undefined || val === null || val === ''
          || (Array.isArray(val) && val.length === 0)
        if (empty) missing.add(q.id)
      }
    }
    if (missing.size > 0) {
      setQErrors(missing)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Inject auto-berekende waarden (bijv. leeftijd uit geboortedatum)
    const enrichedResponses: typeof responses = { ...responses }
    for (const q of intakeQuestionnaire.questions) {
      if (q.role === 'age_years' && birthDate) {
        enrichedResponses[q.id] = calculateAge(birthDate)
      }
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
        responses:        enrichedResponses,
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

    // Bevestigings-e-mail — awaiten om statusUrl terug te krijgen
    try {
      const res = await fetch('/api/email/bevestiging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, assignmentId }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.statusUrl) setStatusUrl(json.statusUrl)
      }
    } catch {
      // stil falen — e-mail is niet fataal voor de flow
    }

    setSaving(false)
    setDone(true)
  }

  // ─── Klaar ────────────────────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center shadow-sm space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Aanmelding ontvangen!</h2>
          <p className="text-sm text-green-700 leading-relaxed max-w-xs mx-auto">
            Bedankt voor je aanmelding, {firstName}. Een medewerker van Vita Health neemt contact met je op
            over de verdere stappen.
          </p>
        </div>
        {statusUrl && (
          <a
            href={statusUrl}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-green-300 px-4 py-2.5 text-sm font-medium text-green-800 hover:bg-green-100 transition-colors"
          >
            <ExternalLink size={15} />
            Mijn status volgen
          </a>
        )}
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

        {/* ── Stap 1: Laden (wachten op e-mailcheck bij deep-link) ─────────────── */}
        {step === 1 && checkingInitialEmail && (
          <div className="p-6 flex items-center gap-3 text-sm text-[#64748b]">
            <svg className="animate-spin h-4 w-4 text-[#1f1683] shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Gegevens ophalen…
          </div>
        )}

        {/* ── Stap 1: Bekend e-mailadres → veilige hervat-link gemaild ────────── */}
        {step === 1 && !checkingInitialEmail && resumeEmailSent && (
          <div className="p-6">
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-sm">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
                <CheckCircle2 size={22} className="text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-green-800 mb-1">Check je e-mail</h2>
              <p className="text-sm text-green-700 leading-relaxed max-w-sm mx-auto">
                Als dit e-mailadres bij ons bekend is, hebben we je een e-mail gestuurd met een
                veilige link om je aanmelding te hervatten. Controleer ook je spam-map.
              </p>
            </div>
          </div>
        )}

        {/* ── Stap 1: Persoonsgegevens ────────────────────────────────────────── */}
        {step === 1 && !checkingInitialEmail && resumeInfo === null && !resumeEmailSent && (
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
              <DateFieldNL value={birthDate} onChange={setBirthDate} className={INPUT} />
            </Field>
          </div>
        )}

        {/* ── Stap 1: Hervatten-banner (e-mailadres al bekend) ─────────────────── */}
        {step === 1 && !checkingInitialEmail && resumeInfo !== null && (() => {
          const status = resumeInfo.status

          // Statussen waarbij de aanmelding (stap 1–4) volledig is doorlopen
          const COMPLETED = [
            'vragenlijst_ingevuld', 'intake_akkoord',
            'kit_opgestuurd', 'kit_retour', 'uitslag_bekend', 'uitslag_besproken',
          ]
          const isCompleted = COMPLETED.includes(status)
          const isRejected  = status === 'intake_afgewezen'
          const isOnHold    = status === 'intake_on_hold'

          const statusUrl = resumeInfo.token ? `/portal/status/${resumeInfo.token}` : null

          const canGoToStep4 = status === 'toestemming_gegeven' && resumeInfo.assignmentId !== null
          const resumeLabel = canGoToStep4
            ? 'de vragenlijst'
            : !resumeInfo.hasAddress
              ? 'je gegevens'
              : 'de toestemmingen'
          const resumeDescription = canGoToStep4
            ? 'Je hebt de toestemmingen al gegeven, maar de vragenlijst is nog niet ingevuld.'
            : !resumeInfo.hasAddress
              ? 'Je bent al uitgenodigd. Vul je gegevens aan om de aanmelding te voltooien.'
              : 'Je gegevens zijn geregistreerd, maar je toestemmingen zijn nog niet gegeven.'

          // Knop naar statuspagina (hergebruikt in meerdere takken)
          const statusButton = statusUrl ? (
            <a
              href={statusUrl}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
            >
              <ExternalLink size={15} />
              Mijn status bekijken
            </a>
          ) : null

          return (
            <div className="p-6 space-y-5">

              {/* ── Volledig afgerond ── */}
              {isCompleted ? (
                <>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <CheckCircle2 size={24} className="text-green-600" />
                    </div>
                    <p className="text-base font-bold text-green-800">Aanmelding al voltooid</p>
                    <p className="text-sm text-green-700 leading-relaxed max-w-sm mx-auto">
                      {resumeInfo.firstName ? `${resumeInfo.firstName}, je` : 'Je'} hebt de volledige aanmelding
                      al afgerond. Je hoeft niets meer te doen — een medewerker van Vita Health begeleidt je
                      verder in het proces.
                    </p>
                  </div>
                  {statusButton}
                </>

              /* ── Afgewezen ── */
              ) : isRejected ? (
                <>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <AlertTriangle size={24} className="text-red-600" />
                    </div>
                    <p className="text-base font-bold text-red-800">Aanmelding afgerond</p>
                    <p className="text-sm text-red-700 leading-relaxed max-w-sm mx-auto">
                      Op basis van je intake is besloten dat de Vita Health Check op dit moment niet voor jou
                      geschikt is. Je aanmelding is hiermee afgerond. Heb je vragen? Neem contact op met
                      Vita Health.
                    </p>
                  </div>
                  {statusButton}
                </>

              /* ── On hold (mogelijke contra-indicatie) ── */
              ) : isOnHold ? (
                <>
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-center space-y-2">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                      <AlertTriangle size={24} className="text-orange-600" />
                    </div>
                    <p className="text-base font-bold text-orange-800">We nemen contact met je op</p>
                    <p className="text-sm text-orange-700 leading-relaxed max-w-sm mx-auto">
                      Je hebt aangegeven dat mogelijk een van de aandachtspunten op jou van toepassing is.
                      Een medewerker van Vita Health neemt contact met je op om te bespreken of deelname
                      veilig en mogelijk is.
                    </p>
                  </div>
                  {statusButton}
                </>

              /* ── Nog bezig: doorgaan of opnieuw ── */
              ) : (
                <>
                  <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 p-4">
                    <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-blue-800">E-mailadres al bekend</p>
                      <p className="text-sm text-blue-700">
                        Het adres <strong>{email}</strong> is al bekend in ons systeem
                        {resumeInfo.firstName ? ` (${resumeInfo.firstName})` : ''}.{' '}
                        {resumeDescription}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <button
                      onClick={handleResume}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
                    >
                      Doorgaan bij {resumeLabel}
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={handleStartFresh}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2.5 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                    >
                      Toch opnieuw aanmelden
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })()}

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

            {/* Documentenblok */}
            <div className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-4">
              <p className="text-sm text-[#475569] mb-3 leading-relaxed">
                Lees de onderstaande documenten zorgvuldig door voordat u de toestemmingen bevestigt:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="/deelnemersinformatie-vita-health.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#1f1683] bg-white px-4 py-2 text-sm font-medium text-[#1f1683] hover:bg-[#eef4ff] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Deelnemersinformatie
                </a>
                <a
                  href="/privacyverklaring-vita-health.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#475569] hover:border-[#1f1683] hover:text-[#1f1683] hover:bg-[#eef4ff] transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Privacyverklaring
                </a>
              </div>
            </div>

            {/* Verplichte toestemmingen */}
            <div>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">
                Verplichte toestemmingen — alle vinkjes zijn nodig om deel te nemen
              </p>
              <div className="space-y-2.5">
                {requiredConsents.map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={required[i] ?? false}
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
            {optionalConsents.length > 0 && (
            <div className="border-t border-[#f1f5f9] pt-4">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wide mb-3">
                Optionele toestemmingen
              </p>
              <div className="space-y-2.5">
                {optionalConsents.map((text, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={optional[i] ?? false}
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
            )}
          </div>
        )}

        {/* ── Stap 4: Screener (uitsluitingscriteria) ─────────────────────────── */}
        {step === 4 && intakeQuestionnaire && screeningChoice === null && (
          <div className="p-6 space-y-5">
            <h2 className="text-base font-semibold text-[#1e293b]">Geschiktheidscheck</h2>

            {/* Waarschuwingsblok */}
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-orange-800 mb-2">
                {SCREENER_INTRO}
              </p>
              <ul className="space-y-1 text-sm text-orange-700">
                {SCREENER_CRITERIA.map((item, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Keuzebuttons */}
            <p className="text-sm font-medium text-[#1e293b]">Maak een keuze:</p>
            <div className="space-y-3">
              <button
                type="button"
                onClick={async () => {
                  // Verklaring 'niet van toepassing' vastleggen (best-effort);
                  // de deelnemer gaat hoe dan ook door naar de vragenlijst.
                  if (clientId) {
                    await fetch('/api/portal/intake-screener', {
                      method:  'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body:    JSON.stringify({ clientId, choice: 'ok' }),
                    }).catch(() => {})
                  }
                  setScreeningChoice('ok')
                }}
                className="w-full flex items-start gap-3 rounded-lg border border-[#e2e8f0] bg-white p-4 text-left hover:border-[#1f1683] hover:bg-[#eef4ff] transition-colors group"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#e2e8f0] group-hover:border-[#1f1683]">
                  <span className="h-2.5 w-2.5 rounded-full" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#1e293b]">Deze punten zijn niet op mij van toepassing</span>
                  <span className="block text-xs text-[#64748b] mt-0.5">Ik kan doorgaan met de vragenlijst.</span>
                </span>
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (!clientId) return
                  // Via API route met admin client — RLS blokkeert directe update vanuit portaal
                  await fetch('/api/portal/intake-screener', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ clientId, choice: 'hold' }),
                  })
                  setScreeningChoice('hold')
                }}
                className="w-full flex items-start gap-3 rounded-lg border border-[#e2e8f0] bg-white p-4 text-left hover:border-orange-400 hover:bg-orange-50 transition-colors group"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#e2e8f0] group-hover:border-orange-400">
                  <span className="h-2.5 w-2.5 rounded-full" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-[#1e293b]">Ik denk dat één van deze punten op mij van toepassing is</span>
                  <span className="block text-xs text-[#64748b] mt-0.5">Vita Health neemt contact met u op om dit te bespreken.</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Stap 4: On hold melding ──────────────────────────────────────────── */}
        {step === 4 && intakeQuestionnaire && screeningChoice === 'hold' && (
          <div className="p-8 text-center space-y-4">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 mx-auto">
              <AlertTriangle size={26} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1e293b] mb-2">We nemen contact met u op</h2>
              <p className="text-sm text-[#64748b] leading-relaxed max-w-sm mx-auto">
                Bedankt voor uw eerlijkheid. Een medewerker van Vita Health neemt zo snel mogelijk
                contact met u op om te bespreken of deelname voor u veilig en mogelijk is.
              </p>
            </div>
          </div>
        )}

        {/* ── Stap 4: Intake vragenlijst ──────────────────────────────────────── */}
        {step === 4 && intakeQuestionnaire && screeningChoice === 'ok' && (
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
              {intakeQuestionnaire.questions.filter(q => q.role !== 'age_years').map(q => {
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
                        min={q.min}
                        max={q.max}
                        value={(responses[q.id] as number | null) ?? ''}
                        onChange={e => {
                          setResponses(prev => ({ ...prev, [q.id]: e.target.value === '' ? null : Number(e.target.value) }))
                          setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                        }}
                        className={`h-10 w-full max-w-[180px] rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] ${hasError ? 'border-red-300' : 'border-[#e2e8f0] bg-white'}`}
                      />
                    )}

                    {/* SHORT TEXT */}
                    {q.type === 'short_text' && (
                      <input
                        type="text"
                        maxLength={256}
                        value={(responses[q.id] as string) ?? ''}
                        onChange={e => {
                          setResponses(prev => ({ ...prev, [q.id]: e.target.value }))
                          setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                        }}
                        className={`h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] ${hasError ? 'border-red-300 bg-white' : 'border-[#e2e8f0] bg-white'}`}
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
                      <div className="mt-1 inline-flex flex-col">
                        <div className="flex gap-1.5">
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
                        {(q.leftLabel || q.rightLabel) && (
                          <div className="flex justify-between mt-1.5">
                            <span className="text-xs text-[#94a3b8]">{q.leftLabel ?? ''}</span>
                            <span className="text-xs text-[#94a3b8]">{q.rightLabel ?? ''}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SCALE (1–5 of configureerbaar) */}
                    {q.type === 'scale' && (() => {
                      const scaleMin = q.min ?? 1
                      const scaleMax = q.max ?? 5
                      const steps = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i)
                      return (
                        <div className="mt-1 inline-flex flex-col">
                          <div className="flex gap-1.5">
                            {steps.map(n => {
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
                          {(q.leftLabel || q.rightLabel) && (
                            <div className="flex justify-between mt-1.5">
                              <span className="text-xs text-[#94a3b8]">{q.leftLabel ?? ''}</span>
                              <span className="text-xs text-[#94a3b8]">{q.rightLabel ?? ''}</span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* CHECKBOX */}
                    {q.type === 'checkbox' && q.options && (() => {
                      const current = Array.isArray(responses[q.id]) ? responses[q.id] as string[] : []
                      const atMax = q.maxSelections !== undefined && current.length >= q.maxSelections
                      return (
                        <div className="space-y-2">
                          {q.options.map(opt => {
                            const checked = current.includes(opt.value)
                            return (
                              <label key={opt.value} className={`flex items-center gap-2.5 ${!checked && atMax ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!checked && atMax}
                                  onChange={e => {
                                    const next = e.target.checked
                                      ? [...current, opt.value]
                                      : current.filter(v => v !== opt.value)
                                    setResponses(prev => ({ ...prev, [q.id]: next }))
                                    setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                                  }}
                                  className="h-4 w-4 accent-[#1f1683] shrink-0"
                                />
                                <span className="text-sm text-[#1e293b]">{opt.label}</span>
                              </label>
                            )
                          })}
                          {q.maxSelections && (
                            <p className="text-xs text-[#94a3b8] mt-1">
                              Max. {q.maxSelections} keuze{q.maxSelections !== 1 ? 's' : ''}
                              {current.length > 0 ? ` (${current.length} geselecteerd)` : ''}
                            </p>
                          )}
                        </div>
                      )
                    })()}

                    {/* BOOLEAN */}
                    {q.type === 'boolean' && (
                      <div className="flex items-center gap-3 mt-1">
                        {([true, false] as const).map(val => {
                          const selected = responses[q.id] === val
                          return (
                            <button
                              key={String(val)}
                              type="button"
                              onClick={() => {
                                setResponses(prev => ({ ...prev, [q.id]: val }))
                                setQErrors(prev => { const n = new Set(prev); n.delete(q.id); return n })
                              }}
                              className={`px-6 py-2 rounded-lg border text-sm font-medium transition-all ${
                                selected
                                  ? 'bg-[#1f1683] text-white border-[#1f1683]'
                                  : hasError
                                    ? 'border-red-200 bg-white text-red-600 hover:border-[#1f1683] hover:text-[#1f1683]'
                                    : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#1f1683] hover:text-[#1f1683]'
                              }`}
                            >
                              {val ? 'Ja' : 'Nee'}
                            </button>
                          )
                        })}
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

        {/* ── Foutmelding + navigatiebuttons (stap 1–3, niet bij resume-banner of laden) ── */}
        {step <= 3 && resumeInfo === null && !checkingInitialEmail && !resumeEmailSent && (
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
