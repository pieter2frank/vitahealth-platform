/**
 * POST /api/actions/assign
 *
 * Wijst een actie toe aan een medewerker, of heft de toewijzing op.
 * Iedereen die is ingelogd mag toewijzen, maar de gekozen medewerker moet
 * een rol hebben die bij de actie past.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTION_META, roleFitsAction, type ActionType } from '@/lib/actions'
import { z } from 'zod'

const schema = z.object({
  actionType: z.enum([
    'intake_review', 'intake_blocked', 'kit_send',
    'kit_batch', 'result_process', 'enrollment_incomplete',
  ]),
  subjectId:  z.string().uuid(),
  assignedTo: z.string().uuid().nullable(), // null = toewijzing opheffen
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Ongeldige invoer.' }, { status: 400 })
  }
  const { actionType, subjectId, assignedTo } = parsed.data
  const admin = createAdminClient()

  // ── Toewijzing opheffen ────────────────────────────────────────────────────
  if (assignedTo === null) {
    const { error } = await admin
      .from('vh_action_assignment')
      .delete()
      .eq('action_type', actionType)
      .eq('subject_id', subjectId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, assignedTo: null })
  }

  // ── Toewijzen: rol van medewerker controleren ──────────────────────────────
  const { data: member } = await admin
    .from('vh_medewerker')
    .select('id, name, role')
    .eq('id', assignedTo)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Medewerker niet gevonden.' }, { status: 404 })
  }

  const meta = ACTION_META[actionType as ActionType]
  if (!roleFitsAction(member.role, meta.requiredRole)) {
    return NextResponse.json({
      error: `${member.name} (${member.role}) kan deze actie niet oppakken — vereist: ${meta.requiredRole}.`,
    }, { status: 422 })
  }

  // Upsert op (action_type, subject_id)
  const { error } = await admin
    .from('vh_action_assignment')
    .upsert(
      { action_type: actionType, subject_id: subjectId, assigned_to: assignedTo, assigned_by: user.id },
      { onConflict: 'action_type,subject_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, assignedTo, assigneeName: member.name })
}
