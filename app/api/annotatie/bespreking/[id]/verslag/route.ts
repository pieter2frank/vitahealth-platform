import { NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { caseLabel } from '@/lib/annotation'
import { getIdentities } from '@/lib/pii/identity'
import { logAuditEvent } from '@/lib/audit'

// GET /api/annotatie/bespreking/[id]/verslag — verslag-PDF van de bespreking
// (kwaliteitsdossier/aantoonbaarheid): per casus de teamvraag, de bespreek-
// status en de vastgelegde notities. Alleen medisch team.

export const dynamic = 'force-dynamic'

const BRAND = rgb(0.122, 0.086, 0.514)
const INK   = rgb(0.118, 0.161, 0.231)
const MUTED = rgb(0.392, 0.455, 0.545)

const A4: [number, number] = [595.28, 841.89]
const M = 56

// Helvetica (WinAnsi) kan geen willekeurige unicode aan — onbekende tekens vervangen.
function safe(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/–|—/g, '-').replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF€]/g, '?')
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = []
  for (const rawLine of safe(text).split('\n')) {
    const words = rawLine.split(/\s+/)
    let line = ''
    for (const w of words) {
      const probe = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(probe, size) <= maxWidth) { line = probe; continue }
      if (line) out.push(line)
      line = w
    }
    out.push(line)
  }
  return out
}

const fmtDatum = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: 'Ongeldig id.' }, { status: 400 })

  const admin = createAdminClient()
  const [{ data: meeting }, { data: cases }] = await Promise.all([
    admin.from('vh_team_meeting').select('id, title, meeting_date, status').eq('id', id).maybeSingle(),
    admin.from('vh_team_meeting_case')
      .select('client_id, position, discussed, discussed_at, notes')
      .eq('meeting_id', id).order('position'),
  ])
  if (!meeting || !cases?.length) return NextResponse.json({ error: 'Bespreking niet gevonden.' }, { status: 404 })

  const clientIds = cases.map(c => c.client_id as string)
  const [{ data: clients }, idents, { data: reviews }, { data: anns }] = await Promise.all([
    admin.from('vh_client').select('id, gender').in('id', clientIds),
    getIdentities(admin, clientIds),
    admin.from('vh_client_team_review').select('client_id, team_vraag').in('client_id', clientIds),
    admin.from('vh_annotation').select('client_id, team_vraag').eq('status', 'ingediend').in('client_id', clientIds),
  ])
  const genderById = new Map((clients ?? []).map(c => [c.id, c.gender as string | null]))
  const reviewVraag = new Map((reviews ?? []).map(r => [r.client_id as string, r.team_vraag as string | null]))
  const annVragen = new Map<string, string[]>()
  for (const a of anns ?? []) {
    if (!a.team_vraag) continue
    const list = annVragen.get(a.client_id as string) ?? []
    list.push(a.team_vraag as string)
    annVragen.set(a.client_id as string, list)
  }

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const width = A4[0] - 2 * M

  let page: PDFPage = doc.addPage(A4)
  let y = A4[1] - M

  const ensure = (needed: number) => {
    if (y - needed < M) { page = doc.addPage(A4); y = A4[1] - M }
  }
  const text = (s: string, opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}) => {
    const { size = 10, f = font, color = INK, gap = 4 } = opts
    for (const line of wrap(s, f, size, width)) {
      ensure(size + gap)
      page.drawText(line, { x: M, y, size, font: f, color })
      y -= size + gap
    }
  }
  const spacer = (h = 8) => { y -= h }

  // ── Kop ──────────────────────────────────────────────────────────────────────
  text('VITA HEALTH — MEDISCH EXPERTTEAM', { size: 9, f: bold, color: BRAND })
  spacer(2)
  text(`Verslag casusbespreking: ${meeting.title}`, { size: 16, f: bold })
  text(`Datum bespreking: ${fmtDatum(meeting.meeting_date)}`, { size: 10, color: MUTED })
  const done = cases.filter(c => c.discussed).length
  text(`Casussen: ${cases.length} — besproken: ${done} — status: ${meeting.status}`, { size: 10, color: MUTED })
  text(`Gegenereerd op ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}`, { size: 9, color: MUTED })
  spacer(10)

  // ── Per casus ────────────────────────────────────────────────────────────────
  cases.forEach((c, i) => {
    ensure(80)
    const ident = idents.get(c.client_id as string)
    const naam = [ident?.firstName, ident?.lastName].filter(Boolean).join(' ')
    const label = caseLabel(ident?.birthDate ?? null, genderById.get(c.client_id as string) ?? null)

    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: A4[0] - M, y: y + 2 }, thickness: 0.75, color: rgb(0.886, 0.91, 0.94) })
    spacer(10)
    text(`${i + 1}. ${label}${naam ? ` - ${naam}` : ''}`, { size: 12, f: bold })
    text(c.discussed
      ? `Besproken${c.discussed_at ? ` op ${new Date(c.discussed_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}`
      : 'Niet besproken', { size: 9, color: c.discussed ? rgb(0.05, 0.48, 0.37) : MUTED })
    spacer(4)

    const vragen = [
      ...(reviewVraag.get(c.client_id as string) ? [reviewVraag.get(c.client_id as string) as string] : []),
      ...(annVragen.get(c.client_id as string) ?? []),
    ]
    if (vragen.length) {
      text('Vraag aan het expertteam:', { size: 9, f: bold, color: BRAND })
      for (const v of vragen) text(v, { size: 10 })
      spacer(4)
    }

    text('Besproken in het expertteam:', { size: 9, f: bold, color: BRAND })
    text(c.notes ? (c.notes as string) : '(geen notities vastgelegd)', { size: 10, color: c.notes ? INK : MUTED })
    spacer(12)
  })

  spacer(6)
  text('Dit verslag is onderdeel van het kwaliteitsdossier van Vitahealth BV en bevat medische persoonsgegevens - vertrouwelijk behandelen.', { size: 8, color: MUTED })

  const bytes = await doc.save()

  logAuditEvent({
    actorUserId:  auth.userId,
    actorRole:    'medisch_deskundige',
    resourceType: 'annotation',
    resourceId:   meeting.id as string,
    action:       'export',
    outcome:      'success',
    reason:       `Verslag casusbespreking geëxporteerd: ${meeting.title}`,
  }).catch(() => {})

  const fileDate = meeting.meeting_date as string
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="verslag-casusbespreking-${fileDate}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
