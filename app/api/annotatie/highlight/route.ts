import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'

// Tekst-highlights bij een annotatie (fase 2).
//   POST   { roundId, clientId, selected_text, context_before?, context_after?, note? }
//   DELETE { highlightId }
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => ({}))
  const { roundId, clientId } = body
  const selected = typeof body.selected_text === 'string' ? body.selected_text.trim() : ''
  if (!isUuid(roundId) || !isUuid(clientId)) return NextResponse.json({ error: 'Ongeldige casus.' }, { status: 400 })
  if (!selected) return NextResponse.json({ error: 'Geen tekst geselecteerd.' }, { status: 400 })

  const admin = createAdminClient()

  // Casus moet in deze ronde bestaan.
  const { data: caseRow } = await admin
    .from('vh_annotation_case').select('id')
    .eq('round_id', roundId).eq('client_id', clientId).maybeSingle()
  if (!caseRow) return NextResponse.json({ error: 'Casus niet gevonden.' }, { status: 404 })

  // Annotatie ophalen of aanmaken (highlight hangt aan annotation_id).
  await admin.from('vh_annotation')
    .upsert({ round_id: roundId, client_id: clientId, arts_user_id: auth.userId },
            { onConflict: 'round_id,client_id,arts_user_id', ignoreDuplicates: true })
  const { data: ann } = await admin.from('vh_annotation').select('id')
    .eq('round_id', roundId).eq('client_id', clientId).eq('arts_user_id', auth.userId).single()
  if (!ann) return NextResponse.json({ error: 'Annotatie kon niet worden aangemaakt.' }, { status: 500 })

  const { data: hl, error } = await admin.from('vh_annotation_highlight')
    .insert({
      annotation_id:  ann.id,
      source_field:   typeof body.source_field === 'string' ? body.source_field.slice(0, 40) : null,
      selected_text:  selected.slice(0, 2000),
      context_before: typeof body.context_before === 'string' ? body.context_before.slice(0, 200) : null,
      context_after:  typeof body.context_after === 'string' ? body.context_after.slice(0, 200) : null,
      note:           typeof body.note === 'string' ? body.note.slice(0, 2000) : null,
    })
    .select('id, selected_text, note').single()
  if (error) {
    console.error('[annotatie] highlight opslaan mislukt:', error)
    return NextResponse.json({ error: 'Highlight opslaan mislukt.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, highlight: hl })
}

export async function DELETE(req: Request) {
  const auth = await requireRole(['arts', 'leefstijlarts'])
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { highlightId } = await req.json().catch(() => ({}))
  if (!isUuid(highlightId)) return NextResponse.json({ error: 'Ongeldige highlight.' }, { status: 400 })

  const admin = createAdminClient()

  // Eigenaarschap controleren: highlight → annotatie → arts.
  const { data: hl } = await admin
    .from('vh_annotation_highlight')
    .select('id, vh_annotation ( arts_user_id )')
    .eq('id', highlightId).maybeSingle()
  const ann = hl ? (Array.isArray(hl.vh_annotation) ? hl.vh_annotation[0] : hl.vh_annotation) : null
  if (!hl || ann?.arts_user_id !== auth.userId) {
    return NextResponse.json({ error: 'Niet gevonden.' }, { status: 404 })
  }

  const { error } = await admin.from('vh_annotation_highlight').delete().eq('id', highlightId)
  if (error) return NextResponse.json({ error: 'Verwijderen mislukt.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
