import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { sendEmail } from '@/lib/email/send'
import { logAuditEvent } from '@/lib/audit'

// POST /api/annotatie/rondes  { title, note, clientIds[] }
// Admin stelt een ronde samen en mailt de artsen dat er casussen klaarstaan.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ANNOTATIE_URL = process.env.NEXT_PUBLIC_ANNOTATIE_URL ?? 'https://annotatie.vita-health.nl'

export async function POST(req: Request) {
  const auth = await requireRole(['admin'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : ''
  const note  = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : ''
  const clientIds: string[] = Array.isArray(body.clientIds)
    ? [...new Set((body.clientIds as unknown[]).filter(v => typeof v === 'string' && isUuid(v)) as string[])]
    : []

  if (!title)             return NextResponse.json({ error: 'Titel ontbreekt.' }, { status: 400 })
  if (clientIds.length === 0) return NextResponse.json({ error: 'Geen dossiers geselecteerd.' }, { status: 400 })

  const admin = createAdminClient()

  // Ronde aanmaken
  const { data: round, error: rErr } = await admin
    .from('vh_annotation_round')
    .insert({ title, note: note || null, created_by: auth.name })
    .select('id').single()
  if (rErr || !round) {
    console.error('[annotatie] ronde aanmaken mislukt:', rErr)
    return NextResponse.json({ error: 'Ronde aanmaken mislukt.' }, { status: 500 })
  }

  // Casussen koppelen
  const { error: cErr } = await admin
    .from('vh_annotation_case')
    .insert(clientIds.map(client_id => ({ round_id: round.id, client_id })))
  if (cErr) {
    console.error('[annotatie] casussen koppelen mislukt:', cErr)
    return NextResponse.json({ error: 'Dossiers koppelen mislukt.' }, { status: 500 })
  }

  // Artsen ophalen (e-mail zit in auth.users, niet in vh_medewerker)
  const { data: team } = await admin
    .from('vh_medewerker').select('user_id').in('role', ['arts', 'leefstijlarts'])
  const teamIds = new Set((team ?? []).map(t => t.user_id as string))

  let mailed = 0
  if (teamIds.size > 0) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
    const emails = (list?.users ?? [])
      .filter(u => teamIds.has(u.id) && u.email)
      .map(u => u.email as string)

    if (emails.length > 0) {
      const n = clientIds.length
      const { ok } = await sendEmail({
        to: emails,
        subject: `Er staan ${n} dossier${n === 1 ? '' : 's'} klaar om te annoteren`,
        html: `
          <div style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.6">
            <p>Beste collega,</p>
            <p>Er ${n === 1 ? 'staat' : 'staan'} <strong>${n} dossier${n === 1 ? '' : 's'}</strong> klaar om te annoteren${title ? ` in de ronde <strong>${title}</strong>` : ''}.</p>
            ${note ? `<p style="color:#475569">${note}</p>` : ''}
            <p><a href="${ANNOTATIE_URL}" style="display:inline-block;background:#1f1683;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open de annotatiemodule</a></p>
            <p style="color:#94a3b8;font-size:13px">Vita Health — medisch team</p>
          </div>`,
      })
      if (ok) mailed = emails.length
    }
  }

  logAuditEvent({
    actorUserId:  auth.userId,
    actorRole:    'admin',
    resourceType: 'annotation',
    resourceId:   round.id,
    action:       'create',
    outcome:      'success',
    reason:       `Annotatieronde aangemaakt (${clientIds.length} casussen, ${mailed} artsen gemaild)`,
    metadata:     { cases: clientIds.length, mailed },
  }).catch(() => {})

  return NextResponse.json({ ok: true, roundId: round.id, casesCount: clientIds.length, mailed })
}
