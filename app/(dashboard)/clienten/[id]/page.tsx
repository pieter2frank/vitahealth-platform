import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { logAuditEvent } from '@/lib/audit'
import Link from 'next/link'
import { formatDate, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { ArrowLeft, Pencil, TestTube2, User, Phone, Mail, MapPin, Calendar, ShieldAlert, ShieldCheck } from 'lucide-react'
import { SCREENER_DECLARATION_LABEL } from '@/lib/screener'
import { EditClientForm } from './EditClientForm'
import { TestkitLinker } from '@/components/testkits/TestkitLinker'
import { DeleteButton } from '@/components/ui/DeleteButton'
import { ClientQuestionnaireSection } from './ClientQuestionnaireSection'
import { ClientNotesSection } from './ClientNotesSection'
import { ClientDocumentsSection } from './ClientDocumentsSection'
import { EnrollmentStatusSection } from './EnrollmentStatusSection'
import { ReminderButton } from './ReminderButton'

const GENDER_LABELS: Record<string, string> = {
  man:             'Man',
  vrouw:           'Vrouw',
  anders:          'Anders',
  zeg_liever_niet: 'Zeg ik liever niet',
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bewerken?: string }>
}) {
  const { id } = await params
  const { bewerken } = await searchParams
  const supabase = await createClient()

  // Medewerker ophalen voor auditlog
  const { data: { user } } = await supabase.auth.getUser()

  const { data: client } = await supabase
    .from('vh_client')
    .select('id, first_name, last_name, email, phone, birth_date, gender, address, city, postal_code, created_at, enrollment_status')
    .eq('id', id)
    .single()

  if (!client) notFound()

  // Auditlog: inzage cliëntdossier (fire-and-forget — blokkeert pagina niet)
  if (user) {
    logAuditEvent({
      actorUserId:      user.id,
      actorRole:        'medewerker_regulier',
      subjectClientId:  client.id,
      resourceType:     'client',
      resourceId:       client.id,
      action:           'view',
      outcome:          'success',
    }).catch(() => {}) // stil falen
  }

  const [
    { data: testkits },
    { data: qaRaw },
    { data: allQuestionnaires },
    { data: clientNote },
    { data: clientDocuments },
    { data: screenerResp },
  ] = await Promise.all([
    supabase
      .from('vh_testkit')
      .select('id, barcode, date, status, retour_date, results_date')
      .eq('assigned_client_id', id)
      .order('date', { ascending: false }),
    supabase
      .from('vh_questionnaire_assignment')
      .select('id, questionnaire_id, status, assigned_at, vh_questionnaire(title)')
      .eq('client_id', id)
      .order('assigned_at', { ascending: false }),
    supabase
      .from('vh_questionnaire')
      .select('id, title')
      .eq('status', 'active')
      .order('title'),
    supabase
      .from('vh_client_note')
      .select('id, notes, actions, created_by, updated_by, created_at, updated_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vh_client_document')
      .select('id, client_id, filename, storage_path, file_size, uploaded_by, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('vh_screener_response')
      .select('declaration, criteria_text, criteria_version, created_at')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const questionnaireAssignments = (qaRaw ?? []).map(a => ({
    id: a.id,
    questionnaire_id: a.questionnaire_id,
    questionnaire_title: (a.vh_questionnaire as unknown as { title: string } | null)?.title ?? '—',
    status: a.status as string,
    assigned_at: a.assigned_at as string,
  }))

  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL ?? ''

  if (bewerken === '1') {
    return <EditClientForm client={client} />
  }

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <Link href="/clienten" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar cliënten
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e293b]">
              {client.first_name} {client.last_name}
            </h1>
            <p className="text-sm text-[#64748b] mt-0.5">
              Cliënt sinds {formatDate(client.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ReminderButton
              clientId={client.id}
              clientEmail={client.email}
              enrollmentStatus={client.enrollment_status ?? 'aangemeld'}
            />
            <Link
              href={`/clienten/${id}?bewerken=1`}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
            >
              <Pencil size={14} />
              Bewerken
            </Link>
            <DeleteButton
              table="vh_client"
              id={client.id}
              redirectTo="/clienten"
              entityLabel={`${client.first_name} ${client.last_name}`}
              blockedMessage={
                testkits && testkits.length > 0
                  ? `Er ${testkits.length === 1 ? 'is' : 'zijn'} ${testkits.length} testkit${testkits.length === 1 ? '' : 's'} gekoppeld aan deze cliënt. Ontkoppel of verwijder de testkits eerst voordat je de cliënt verwijdert.`
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {/* ── Aanmeldstatus ──────────────────────────────────────────────────── */}
      <EnrollmentStatusSection
        clientId={client.id}
        initialStatus={client.enrollment_status ?? 'aangemeld'}
        assignedKitId={testkits?.[0]?.id ?? null}
      />

      {/* ── Geschiktheidsverklaring (stap 4) ───────────────────────────────── */}
      {screenerResp && (() => {
        const mogelijk = screenerResp.declaration === 'mogelijk_van_toepassing'
        const criteria = (screenerResp.criteria_text as string[] | null) ?? []
        return (
          <div className={`mb-5 rounded-xl border shadow-sm overflow-hidden ${mogelijk ? 'border-orange-200' : 'border-[#e2e8f0]'}`}>
            <div className={`flex items-center gap-2 border-b px-5 py-3 ${mogelijk ? 'border-orange-100 bg-orange-50' : 'border-[#f1f5f9] bg-[#f8fafc]'}`}>
              {mogelijk
                ? <ShieldAlert size={15} className="text-orange-600" />
                : <ShieldCheck size={15} className="text-emerald-600" />}
              <h2 className="text-sm font-semibold text-[#1e293b]">Geschiktheidsverklaring deelnemer</h2>
            </div>
            <div className="px-5 py-4 space-y-2">
              <p className={`text-sm font-medium ${mogelijk ? 'text-orange-800' : 'text-emerald-700'}`}>
                {SCREENER_DECLARATION_LABEL[screenerResp.declaration as keyof typeof SCREENER_DECLARATION_LABEL]}
              </p>
              <p className="text-xs text-[#94a3b8]">
                Verklaard op {formatDateTime(screenerResp.created_at)} · criterialijst v{screenerResp.criteria_version}
              </p>
              <details className="mt-1">
                <summary className="text-xs text-[#1f1683] cursor-pointer hover:underline">Getoonde uitsluitingscriteria bekijken</summary>
                <ul className="mt-2 space-y-1 text-xs text-[#64748b]">
                  {criteria.map((c, i) => (
                    <li key={i} className="flex gap-2"><span className="shrink-0">•</span><span>{c}</span></li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )
      })()}

      {/* ── Bovenste rij: 3 blokken ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Persoonsgegevens */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <User size={15} className="text-[#94a3b8]" />
            Persoonsgegevens
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748b] shrink-0">Volledige naam</dt>
              <dd className="font-medium text-[#1e293b] text-right">{client.first_name} {client.last_name}</dd>
            </div>
            {client.birth_date && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748b] flex items-center gap-1.5 shrink-0"><Calendar size={13} />Geboortedatum</dt>
                <dd className="font-medium text-[#1e293b]">{formatDate(client.birth_date)}</dd>
              </div>
            )}
            {client.gender && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#64748b] shrink-0">Geslacht</dt>
                <dd className="font-medium text-[#1e293b]">{GENDER_LABELS[client.gender] ?? client.gender}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Contactgegevens */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <Phone size={15} className="text-[#94a3b8]" />
            Contactgegevens
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748b] flex items-center gap-1.5 shrink-0"><Mail size={13} />E-mail</dt>
              <dd className="font-medium text-[#1e293b] text-right truncate">{client.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748b] flex items-center gap-1.5 shrink-0"><Phone size={13} />Telefoon</dt>
              <dd className="font-medium text-[#1e293b]">{client.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#64748b] flex items-center gap-1.5 shrink-0"><MapPin size={13} />Adres</dt>
              <dd className="font-medium text-[#1e293b] text-right">
                {client.address ? (
                  <>{client.address}<br />{client.postal_code} {client.city}</>
                ) : '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Testkits */}
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
          <div className="border-b border-[#e2e8f0] px-5 py-4">
            <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2 mb-3">
              <TestTube2 size={15} className="text-[#94a3b8]" />
              Testkits ({testkits?.length ?? 0})
            </h2>
            <TestkitLinker
              clientId={client.id}
              clientName={`${client.first_name} ${client.last_name}`}
            />
          </div>
          {testkits && testkits.length > 0 && (
            <div className="divide-y divide-[#f1f5f9] overflow-y-auto max-h-60">
              {testkits.map((kit) => (
                <div key={kit.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f8fafc] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-[#1e293b] truncate">{kit.barcode}</p>
                    <p className="text-[10px] text-[#94a3b8]">{formatDate(kit.date)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${STATUS_COLORS[kit.status as keyof typeof STATUS_COLORS]}`}>
                    {STATUS_LABELS[kit.status as keyof typeof STATUS_LABELS]}
                  </span>
                  <Link href={`/testkits/${kit.id}`} className="text-xs text-[#1f1683] hover:underline shrink-0">
                    →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Vragenlijsten ───────────────────────────────────────────────────── */}
      <ClientQuestionnaireSection
        clientId={client.id}
        initialAssignments={questionnaireAssignments}
        questionnaires={(allQuestionnaires ?? []).map(q => ({ id: q.id, title: q.title }))}
        portalUrl={portalUrl}
      />

      {/* ── Uitslagen (PDF) — alleen arts/leefstijlarts ─────────────────────── */}
      <ClientDocumentsSection
        clientId={client.id}
        initialDocuments={clientDocuments ?? []}
      />

      {/* ── Aantekeningen arts — alleen arts/leefstijlarts ──────────────────── */}
      <ClientNotesSection
        clientId={client.id}
        initialNotes={clientNote ?? []}
      />
    </div>
  )
}
