/**
 * POST /api/audit/log
 *
 * Endpoint voor client-side audit events (bijv. vanuit EnrollmentStatusSection).
 * Altijd server-side gevalideerd — de client mag niet zelf de actor of outcome bepalen.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAuditEvent, type AuditResourceType, type AuditAction } from '@/lib/audit'
import { isUuid } from '@/lib/validation'
import { z } from 'zod'

const schema = z.object({
  subjectClientId: z.string().uuid().optional().nullable(),
  resourceType:    z.enum([
    'client', 'questionnaire_response', 'questionnaire_assignment',
    'testkit', 'batch_export', 'consent', 'enrollment_status', 'kit_status',
  ]),
  resourceId:      z.string().uuid().optional().nullable(),
  action:          z.enum([
    'view', 'create', 'update', 'delete', 'export',
    'email_sent', 'status_change', 'access_granted', 'access_denied',
  ]),
  reason:          z.string().max(200).optional().nullable(),
  metadata:        z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
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

  const { subjectClientId, resourceType, resourceId, action, reason, metadata } = parsed.data

  // Valideer dat het subject-clientId bestaat en de medewerker erbij mag
  if (subjectClientId && !isUuid(subjectClientId)) {
    return NextResponse.json({ error: 'Ongeldig clientId.' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? ''

  await logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medewerker_regulier',
    subjectClientId: subjectClientId ?? null,
    resourceType:    resourceType as AuditResourceType,
    resourceId:      resourceId ?? null,
    action:          action as AuditAction,
    outcome:         'success',
    reason:          reason ?? undefined,
    ipAddress:       ip,
    metadata:        metadata,
  })

  return NextResponse.json({ ok: true })
}
