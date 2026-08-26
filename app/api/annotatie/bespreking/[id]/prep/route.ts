import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { getAiProvider } from '@/lib/ai'
import { buildClientCaseText } from '@/lib/ai/case-document'

// POST /api/annotatie/bespreking/[id]/prep  { clientId }
// Genereert (of vernieuwt) de AI-voorbereiding voor één besprekingscasus:
// kernvraag, kernpunten en discussiepunten op basis van het PSEUDONIEME
// casusdocument + de arts-input. Geen naam/contactgegevens in de prompt.

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM = [
  'Je bereidt een casusbespreking van het medisch expertteam van Vita Health voor.',
  'Je krijgt een gepseudonimiseerd casusdocument (vragenlijst + biomarkers), de',
  'beoordeling(en) van de arts en eventueel een vraag aan het team.',
  'Schrijf een compacte voorbereiding in het Nederlands, exact in deze vorm,',
  'zonder markdown-tekens:',
  '',
  'KERNVRAAG',
  '(één zin: waar moet het team over beslissen of adviseren)',
  '',
  'KERNPUNTEN',
  '- (3 à 5 punten: de relevante meetwaarden en context, kort en concreet)',
  '',
  'DISCUSSIEPUNTEN',
  '- (2 à 3 punten: waar kan het team over van mening verschillen, welke opties liggen er)',
  '',
  'Wees feitelijk; geen diagnoses of medicatie-adviezen; verzin niets dat niet in de casus staat.',
].join('\n')

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const b = await req.json().catch(() => ({}))
  const clientId = typeof b.clientId === 'string' ? b.clientId : ''
  if (!isUuid(id) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const provider = getAiProvider()
  if (!provider.isConfigured()) return NextResponse.json({ error: 'AI-provider is niet geconfigureerd.' }, { status: 503 })

  const admin = createAdminClient()
  const { data: caseRow } = await admin
    .from('vh_team_meeting_case').select('id')
    .eq('meeting_id', id).eq('client_id', clientId).maybeSingle()
  if (!caseRow) return NextResponse.json({ error: 'Casus niet gevonden in deze bespreking.' }, { status: 404 })

  const [caseDoc, { data: review }, { data: anns }] = await Promise.all([
    buildClientCaseText(clientId),
    admin.from('vh_client_team_review').select('team_vraag').eq('client_id', clientId).maybeSingle(),
    admin.from('vh_annotation')
      .select('algemeen_beeld, advies, team_vraag, verbeterpotentieel')
      .eq('client_id', clientId).eq('status', 'ingediend'),
  ])

  const artsBlokken = (anns ?? []).map((a, i) => [
    `Beoordeling arts ${i + 1}:`,
    a.algemeen_beeld ? `Algemeen beeld: ${a.algemeen_beeld}` : null,
    a.advies ? `Advies: ${a.advies}` : null,
    a.verbeterpotentieel != null ? `Verbeterpotentieel: ${a.verbeterpotentieel}/10` : null,
    a.team_vraag ? `Vraag aan het team: ${a.team_vraag}` : null,
  ].filter(Boolean).join('\n')).join('\n\n')

  const user = [
    'CASUSDOCUMENT',
    caseDoc.text,
    '',
    review?.team_vraag ? `VRAAG AAN HET TEAM (dossier): ${review.team_vraag}\n` : '',
    artsBlokken || '(nog geen ingediende arts-beoordeling)',
    '',
    'Schrijf de voorbereiding volgens het opgegeven format.',
  ].join('\n')

  let text: string
  try {
    text = await provider.chat({ system: SYSTEM, user, maxTokens: 700, temperature: 0.3 })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Genereren mislukt.' }, { status: 502 })
  }

  const { error } = await admin
    .from('vh_team_meeting_case')
    .update({ ai_prep: text, ai_prep_at: new Date().toISOString(), updated_by: auth.userId, updated_at: new Date().toISOString() })
    .eq('id', caseRow.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, text })
}
