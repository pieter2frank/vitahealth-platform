/**
 * GET /api/cron/audit-checks
 *
 * Voert alle auditlog-alertchecks uit. Aanroepen via een externe cron
 * (bijv. Coolify scheduled task, cURL of systemd timer).
 *
 * Beveiliging: vereist CRON_SECRET header.
 * Voorbeeld: curl -H "x-cron-secret: <waarde>" https://platform.vita-health.nl/api/cron/audit-checks
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('run_all_checks', {}, { schema: 'audit' } as object)

  if (error) {
    console.error('[cron/audit-checks] Fout:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[cron/audit-checks] Resultaat:', data)
  return NextResponse.json({ ok: true, result: data })
}
