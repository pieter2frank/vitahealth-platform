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
import { isCronAuthorized } from '@/lib/cron'

export async function GET(req: Request) {
  // Cron-geheim via x-cron-secret of Authorization: Bearer.
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // public.run_all_checks() is een wrapper rond audit.run_all_checks()
  // (zie migratie 051) — PostgREST serveert alleen het public-schema.
  const { data, error } = await admin.rpc('run_all_checks')

  if (error) {
    console.error('[cron/audit-checks] Fout:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  console.log('[cron/audit-checks] Resultaat:', data)
  return NextResponse.json({ ok: true, result: data })
}
