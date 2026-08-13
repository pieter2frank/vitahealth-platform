import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { findClientIdByEmail } from '@/lib/pii/identity'

// POST /api/portal/check-email  { email }
// Controleert of er al een aanmelding met dit e-mailadres bestaat (intake stap 1).
// Fase 2 PII-kluis: zoekt via email_hash in de kluis en vervangt de
// check_enrollment_email-RPC (die de oude e-mailkolom las). Zelfde gedrag als
// voorheen: geeft alleen { exists } terug, nooit gegevens.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}))
  const clean = typeof email === 'string' ? email.trim() : ''
  if (!clean || !clean.includes('@')) return NextResponse.json({ exists: false })

  const admin = createAdminClient()
  const clientId = await findClientIdByEmail(admin, clean)
  return NextResponse.json({ exists: Boolean(clientId) })
}
