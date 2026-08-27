import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAnnotationAccess } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildClientCaseStructured, type CaseSection, type ItemStatus } from '@/lib/annotation-case'
import { caseLabel, FOLLOWUP_DOMAINS } from '@/lib/annotation'
import { getIdentity, getIdentities } from '@/lib/pii/identity'
import { isUuid } from '@/lib/validation'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, MessageCircleQuestion, Stethoscope, FileDown, Monitor } from 'lucide-react'
import { CaseActions } from './CaseActions'
import { AiPrep } from './AiPrep'
import { ManageCases, type AddCandidate } from './ManageCases'
import { GroupedPanel } from './GroupedPanel'

// MDO-dashboard: per casus alle informatie op één (volledig) scherm — casus-
// gegevens, arts-input uit de annotatiemodule, de vraag aan het team prominent
// bovenaan, besprekingsnotities en een besproken-markering.
// Alleen medisch team: de inhoud is medisch.

export const dynamic = 'force-dynamic'

const DOT: Record<ItemStatus, string> = {
  good: 'bg-emerald-500', warn: 'bg-amber-500', alert: 'bg-red-500', neutral: 'bg-[#cbd5e1]',
}
const DOMAIN_LABEL: Record<string, string> = Object.fromEntries(FOLLOWUP_DOMAINS.map(d => [d.value, d.label]))
const fmtDatum = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function SectionCard({ section, pres }: { section: CaseSection; pres?: boolean }) {
  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="border-b border-[#e2e8f0] px-4 py-2.5">
        <h3 className={`font-semibold text-[#1e293b] ${pres ? 'text-[15px]' : 'text-[13px]'}`}>{section.heading}</h3>
      </div>
      <ul className="px-4 py-3">
        {section.items.map((it, i) => (
          <li key={i} className={`mb-1.5 flex items-start gap-2 text-[#334155] ${pres ? 'text-[16px] leading-relaxed' : 'text-[13.5px] leading-snug'}`}>
            <span className={`mt-[0.5em] h-2 w-2 shrink-0 rounded-full ${DOT[it.status]}`} />
            <span>{it.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Scoreboard-tegel: groot kerngetal met status-kleur, leesbaar vanaf een beamer.
const TILE: Record<ItemStatus, string> = {
  good:    'border-emerald-200 bg-emerald-50',
  warn:    'border-amber-200 bg-amber-50',
  alert:   'border-red-200 bg-red-50',
  neutral: 'border-[#e2e8f0] bg-white',
}
const TILE_VALUE: Record<ItemStatus, string> = {
  good: 'text-emerald-700', warn: 'text-amber-700', alert: 'text-red-700', neutral: 'text-[#1e293b]',
}
function Tile({ label, value, sub, status, pres }: {
  label: string; value: string; sub: string | null; status: ItemStatus; pres: boolean
}) {
  return (
    <div className={`rounded-xl border-2 px-4 py-3 shadow-sm ${TILE[status]}`}>
      <p className={`font-semibold uppercase tracking-wide text-[#64748b] ${pres ? 'text-[13px]' : 'text-[11px]'}`}>{label}</p>
      <p className={`font-bold leading-tight ${TILE_VALUE[status]} ${pres ? 'text-6xl' : 'text-3xl'}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-[#64748b] ${pres ? 'text-[15px]' : 'text-[12px]'}`}>{sub}</p>}
    </div>
  )
}

export default async function BesprekingDashboard({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ c?: string; p?: string }>
}) {
  await requireAnnotationAccess(['arts', 'leefstijlarts'])
  const { id } = await params
  const { c, p } = await searchParams
  const pres = p === '1' // presentatiemodus: grotere typografie, beheer verborgen
  if (!isUuid(id)) notFound()

  const admin = createAdminClient()
  const [{ data: meeting }, { data: cases }] = await Promise.all([
    admin.from('vh_team_meeting').select('id, title, meeting_date, status').eq('id', id).maybeSingle(),
    admin.from('vh_team_meeting_case')
      .select('id, client_id, position, discussed, notes, ai_prep, ai_prep_at')
      .eq('meeting_id', id).order('position'),
  ])
  if (!meeting || !cases?.length) notFound()

  const idx = Math.min(Math.max(Number(c ?? 0) || 0, 0), cases.length - 1)
  const cur = cases[idx]
  const qs = (i: number) => `?c=${i}${pres ? '&p=1' : ''}`

  const [{ data: client }, identity, structured, { data: review }, { data: anns }, { data: report }] = await Promise.all([
    admin.from('vh_client').select('gender').eq('id', cur.client_id).maybeSingle(),
    getIdentity(admin, cur.client_id),
    buildClientCaseStructured(cur.client_id),
    admin.from('vh_client_team_review').select('bespreken_team, team_vraag').eq('client_id', cur.client_id).maybeSingle(),
    admin.from('vh_annotation')
      .select('arts_user_id, algemeen_beeld, bespreken_team, team_vraag, advies, verbeterpotentieel, vervolg_domeinen, wearables_nuttig, status')
      .eq('client_id', cur.client_id).eq('status', 'ingediend').order('submitted_at', { ascending: false }),
    admin.from('vh_report').select('document_id').eq('client_id', cur.client_id).order('sample_date', { ascending: false }).limit(1).maybeSingle(),
  ])

  const artsIds = [...new Set((anns ?? []).map(a => a.arts_user_id as string))]
  const { data: med } = artsIds.length
    ? await admin.from('vh_medewerker').select('user_id, name').in('user_id', artsIds)
    : { data: [] as { user_id: string; name: string | null }[] }
  const artsName = new Map((med ?? []).map(m => [m.user_id, m.name ?? 'Onbekende arts']))

  const naam = [identity?.firstName, identity?.lastName].filter(Boolean).join(' ')
  const label = caseLabel(identity?.birthDate ?? null, (client as { gender: string | null } | null)?.gender ?? null)

  // Kandidaten om toe te voegen: dossiers met uitslag of annotatie die nog
  // niet in deze bespreking zitten.
  const inMeeting = new Set(cases.map(cc => cc.client_id as string))
  const [{ data: repIds }, { data: annIds }] = await Promise.all([
    admin.from('vh_report').select('client_id'),
    admin.from('vh_annotation').select('client_id'),
  ])
  const candidateIds = [...new Set([
    ...(repIds ?? []).map(r => r.client_id as string),
    ...(annIds ?? []).map(a => a.client_id as string),
  ])].filter(cid => !inMeeting.has(cid))
  const [candIdents, { data: candClients }] = await Promise.all([
    getIdentities(admin, candidateIds),
    candidateIds.length
      ? admin.from('vh_client').select('id, gender').in('id', candidateIds)
      : Promise.resolve({ data: [] as { id: string; gender: string | null }[] }),
  ])
  const candGender = new Map((candClients ?? []).map(cc => [cc.id, cc.gender as string | null]))
  const candidates: AddCandidate[] = candidateIds.map(cid => {
    const ident = candIdents.get(cid)
    return {
      clientId: cid,
      label: caseLabel(ident?.birthDate ?? null, candGender.get(cid) ?? null),
      name: [ident?.firstName, ident?.lastName].filter(Boolean).join(' ') || null,
    }
  }).sort((a, b) => a.label.localeCompare(b.label))

  const vragen: { bron: string; tekst: string }[] = []
  if (review?.team_vraag) vragen.push({ bron: 'dossier', tekst: review.team_vraag })
  for (const a of anns ?? []) {
    if (a.team_vraag) vragen.push({ bron: artsName.get(a.arts_user_id as string) ?? 'arts', tekst: a.team_vraag as string })
  }

  // Kenmerken-sectie niet meer als kaart: het scoreboard toont de kerngetallen.
  const vragenlijst = structured.sections.find(s => s.heading.startsWith('Vragenlijst'))
  const biomarkers = structured.sections.find(s => s.heading.startsWith('Biomarkers'))
  const risico = structured.sections.find(s => s.heading.startsWith('Verhoogd'))

  return (
    // Breekt uit de max-w-5xl van de annotatie-layout: het hele scherm benutten.
    <div className="mx-[calc(50%-50vw)] px-6 xl:px-10">
      {/* ── Kopregel: bespreking + navigatie ─────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Link href="/besprekingen" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1f1683]">
            <ArrowLeft size={15} /> Besprekingen
          </Link>
          <div>
            <h1 className="text-lg font-semibold leading-tight text-[#1e293b]">{meeting.title}</h1>
            <p className="text-xs text-[#94a3b8]">{fmtDatum(meeting.meeting_date)}</p>
          </div>
          <a href={`/api/annotatie/bespreking/${meeting.id}/verslag`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#1f1683] hover:bg-[#f8fafc]">
            <FileDown size={13} /> Verslag (PDF)
          </a>
          <Link href={`?c=${idx}${pres ? '' : '&p=1'}`}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${pres ? 'border-[#1f1683] bg-[#1f1683] text-white hover:bg-[#1a1270]' : 'border-[#e2e8f0] bg-white text-[#1f1683] hover:bg-[#f8fafc]'}`}>
            <Monitor size={13} /> {pres ? 'Normale weergave' : 'Presentatie'}
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {/* Casus-stippen: klik om te springen; groen = besproken */}
          <div className="mr-2 flex items-center gap-1.5">
            {cases.map((cc, i) => (
              <Link key={cc.id} href={qs(i)} title={`Casus ${i + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition-transform hover:scale-125 ${cc.discussed ? 'bg-emerald-500' : i === idx ? 'bg-[#1f1683]' : 'bg-[#cbd5e1]'} ${i === idx ? 'ring-2 ring-[#1f1683]/30' : ''}`} />
            ))}
          </div>
          <Link href={qs(idx - 1)} aria-disabled={idx === 0}
            className={`inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm text-[#1e293b] ${idx === 0 ? 'pointer-events-none opacity-40' : 'hover:bg-[#f8fafc]'}`}>
            <ChevronLeft size={14} /> Vorige
          </Link>
          <span className="text-xs text-[#94a3b8]">casus {idx + 1} / {cases.length}</span>
          <Link href={qs(idx + 1)} aria-disabled={idx === cases.length - 1}
            className={`inline-flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-sm text-[#1e293b] ${idx === cases.length - 1 ? 'pointer-events-none opacity-40' : 'hover:bg-[#f8fafc]'}`}>
            Volgende <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── Casuskop: wie + acties ───────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className={`font-semibold text-[#1e293b] ${pres ? 'text-2xl' : 'text-base'}`}>{label}</h2>
          {naam && <span className={`text-[#64748b] ${pres ? 'text-2xl' : 'text-base'}`}>· {naam}</span>}
          {cur.discussed && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 size={11} /> Besproken
            </span>
          )}
        </div>
        <CaseActions
          meetingId={meeting.id}
          clientId={cur.client_id}
          initialDiscussed={cur.discussed}
          hasPdf={Boolean(report?.document_id)}
          compact
        />
      </div>

      {/* ── Samenstelling aanpassen (niet in presentatiemodus) ───────────────── */}
      {!pres && (
        <div className="mb-4 flex justify-end">
          <ManageCases meetingId={meeting.id} currentClientId={cur.client_id} candidates={candidates} caseCount={cases.length} />
        </div>
      )}

      {/* ── Scoreboard: kerngetallen als grote tegels ────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Metabole leeftijd" pres={pres}
          value={structured.stats.metabolicAge != null ? `${structured.stats.metabolicAge}` : '—'}
          sub={structured.stats.metabolicAge != null && structured.stats.age != null
            ? `kalender ${structured.stats.age} (${structured.stats.metabolicAge - structured.stats.age >= 0 ? '+' : ''}${structured.stats.metabolicAge - structured.stats.age} jr)`
            : null}
          status={structured.stats.metabolicStatus} />
        <Tile label="Resilience Score" pres={pres}
          value={structured.stats.resilience != null ? `${structured.stats.resilience}` : '—'}
          sub={structured.stats.resilience != null ? 'van 100' : null}
          status={structured.stats.resilienceStatus} />
        <Tile label="BMI" pres={pres}
          value={structured.stats.bmi != null ? String(structured.stats.bmi).replace('.', ',') : '—'}
          sub={structured.stats.bmiLabel}
          status={structured.stats.bmiStatus} />
        <Tile label="Hoogste ziekterisico" pres={pres}
          value={structured.stats.topRisk ? `${String(structured.stats.topRisk.pct ?? '—').replace('.', ',')}%` : 'geen'}
          sub={structured.stats.topRisk
            ? `${structured.stats.topRisk.label} — ${structured.stats.topRisk.notably ? 'opvallend hoger' : 'hoger dan gemiddeld'}`
            : 'geen verhoogd risico'}
          status={structured.stats.topRisk ? (structured.stats.topRisk.notably ? 'alert' : 'warn') : 'good'} />
      </div>
      {structured.stats.projectionAge != null && (
        <p className={`mb-4 -mt-2 text-[#94a3b8] ${pres ? 'text-[14px]' : 'text-[12px]'}`}>
          Projectieleeftijd: {structured.stats.projectionAge} jaar
        </p>
      )}

      {/* ── Vraag aan het expertteam — prominent ─────────────────────────────── */}
      {vragen.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-[#1f1683]/30 bg-[#eef4ff] px-5 py-4 shadow-sm">
          <p className={`mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-[#1f1683] ${pres ? 'text-[14px]' : 'text-xs'}`}>
            <MessageCircleQuestion size={pres ? 17 : 14} /> Vraag aan het expertteam
          </p>
          {vragen.map((v, i) => (
            <p key={i} className={`leading-relaxed text-[#1e293b] ${pres ? 'text-xl' : 'text-[15px]'}`}>
              {v.tekst} <span className={`text-[#64748b] ${pres ? 'text-[14px]' : 'text-xs'}`}>— {v.bron}</span>
            </p>
          ))}
        </div>
      )}

      {/* ── AI-voorbereiding ─────────────────────────────────────────────────── */}
      <AiPrep
        meetingId={meeting.id}
        clientId={cur.client_id}
        initial={(cur as { ai_prep?: string | null }).ai_prep ?? null}
        generatedAt={(cur as { ai_prep_at?: string | null }).ai_prep_at ?? null}
      />

      {/* ── Casusgegevens: standaard alleen wat aandacht vraagt ──────────────── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          {vragenlijst && <GroupedPanel title="Vragenlijst" items={vragenlijst.items} presentation={pres} />}
        </div>
        <div className="space-y-4">
          {risico && <SectionCard section={risico} pres={pres} />}
          {biomarkers && <GroupedPanel title="Biomarkers" items={biomarkers.items} presentation={pres} />}
        </div>
      </div>

      {/* ── Arts-input + besprekingsnotities ─────────────────────────────────── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {(anns ?? []).length === 0 && (
            <div className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-6 text-center text-sm text-[#94a3b8] shadow-sm">
              Nog geen ingediende annotatie voor deze casus.
            </div>
          )}
          {(anns ?? []).map((a, i) => (
            <div key={i} className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-2.5">
                <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1e293b]">
                  <Stethoscope size={13} className="text-[#1f1683]" /> Beoordeling — {artsName.get(a.arts_user_id as string) ?? 'arts'}
                </h3>
                <span className="flex items-center gap-3 text-xs text-[#64748b]">
                  {a.verbeterpotentieel != null && <span>Potentieel <b className="text-[#1e293b]">{a.verbeterpotentieel}</b>/10</span>}
                  {a.bespreken_team != null && <span>Team: {a.bespreken_team ? 'ja' : 'nee'}</span>}
                  {a.wearables_nuttig != null && <span>Wearables: {a.wearables_nuttig ? 'ja' : 'nee'}</span>}
                </span>
              </div>
              <div className="space-y-2.5 px-4 py-3">
                {(a.vervolg_domeinen ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(a.vervolg_domeinen as string[]).map(d => (
                      <span key={d} className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 text-[11px] text-[#64748b]">{DOMAIN_LABEL[d] ?? d}</span>
                    ))}
                  </div>
                )}
                {a.algemeen_beeld && (<><p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b8]">Algemeen beeld</p><p className="text-[13px] text-[#334155]">{a.algemeen_beeld}</p></>)}
                {a.advies && (<><p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b8]">Advies</p><p className="whitespace-pre-wrap text-[13px] text-[#334155]">{a.advies}</p></>)}
              </div>
            </div>
          ))}
        </div>

        <CaseActions
          meetingId={meeting.id}
          clientId={cur.client_id}
          initialNotes={cur.notes ?? ''}
          initialDiscussed={cur.discussed}
          hasPdf={false}
        />
      </div>
      <div className="h-8" />
    </div>
  )
}
