/**
 * Vita Health — Medische auditlog helper
 *
 * Gebruik uitsluitend server-side (server components, route handlers, server actions).
 * Nooit importeren in client components of NEXT_PUBLIC_ context.
 *
 * Regel: log NOOIT medische inhoud (diagnoses, antwoorden, PDF-tekst).
 * Log alleen: wie, wanneer, welke actie, op welke resource-ID, met welk resultaat.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createHash, randomUUID } from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'view'           // inzien van een dossier/record
  | 'create'         // aanmaken
  | 'update'         // wijzigen (inclusief statuswijzigingen)
  | 'delete'         // verwijderen
  | 'export'         // exporteren naar bestand (Excel/CSV)
  | 'email_sent'     // e-mail verstuurd
  | 'status_change'  // expliciete statusovergang (enrollment, kit)
  | 'access_granted' // toegang verleend
  | 'access_denied'  // toegang geweigerd

export type AuditResourceType =
  | 'client'
  | 'questionnaire_response'
  | 'questionnaire_assignment'
  | 'testkit'
  | 'batch_export'
  | 'consent'
  | 'enrollment_status'
  | 'kit_status'
  | 'medewerker'

export type AuditAccessBasis =
  | 'medewerker_regulier'
  | 'medisch_deskundige'
  | 'portaal_eigen_data'
  | 'admin'
  | 'systeem'

export type AuditOutcome = 'success' | 'denied' | 'failed'

export interface AuditEventInput {
  // Wie
  actorUserId:    string | null   // null = portaalgebruiker (anoniem)
  actorRole:      AuditAccessBasis

  // Op wie
  subjectClientId?: string | null

  // Wat
  resourceType:   AuditResourceType
  resourceId?:    string | null
  action:         AuditAction
  reason?:        string

  // Resultaat
  outcome:        AuditOutcome
  denialReason?:  string

  // Context (optioneel — nooit raw IP, altijd gehasht)
  requestId?:     string
  ipAddress?:     string   // wordt gehasht vóór opslag
  sessionId?:     string   // wordt gehasht vóór opslag

  // Vrije metadata — nooit medische inhoud, alleen IDs/statussen/tellers
  metadata?:      Record<string, string | number | boolean | null>
}

// ── Hash helper ───────────────────────────────────────────────────────────────

const HASH_SALT = process.env.AUDIT_HASH_SALT ?? 'vh-audit-salt'

function hashValue(value: string): string {
  return createHash('sha256').update(`${HASH_SALT}:${value}`).digest('hex').slice(0, 32)
}

// ── Better Stack log drain ────────────────────────────────────────────────────
// Stuur elk audit-event ook naar Better Stack als tamper-resistant externe kopie.
// Zelfs als de Supabase database gecompromitteerd wordt, blijft dit log intact.

async function sendToBetterStack(event: AuditEventInput, requestId: string): Promise<void> {
  const token = process.env.BETTERSTACK_SOURCE_TOKEN
  if (!token) return // Niet geconfigureerd — stil overslaan

  try {
    await fetch('https://in.logs.betterstack.com', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        // Better Stack standaard velden
        dt:      new Date().toISOString(),
        level:   event.outcome === 'denied' || event.outcome === 'failed' ? 'warn' : 'info',
        message: `${event.action} ${event.resourceType} — ${event.outcome}`,

        // Audit-specifieke velden (geen medische inhoud)
        actor_user_id:     event.actorUserId,
        actor_role:        event.actorRole,
        subject_client_id: event.subjectClientId,
        resource_type:     event.resourceType,
        resource_id:       event.resourceId,
        action:            event.action,
        outcome:           event.outcome,
        denial_reason:     event.denialReason,
        reason:            event.reason,
        request_id:        requestId,
        // IP gehasht — nooit raw
        ip_hash:           event.ipAddress ? hashValue(event.ipAddress) : null,
        metadata:          event.metadata ?? {},
        source:            'vitahealth-audit',
      }),
    })
  } catch {
    // Extern loggen mag nooit de applicatie blokkeren
    console.warn('[audit] Better Stack niet bereikbaar — alleen Supabase-log beschikbaar')
  }
}

// ── Kern: logAuditEvent ───────────────────────────────────────────────────────

// ── Helper: RPC parameters bouwen ────────────────────────────────────────────

function buildRpcParams(event: AuditEventInput, requestId: string) {
  return {
    p_actor_user_id:     event.actorUserId      ?? null,
    p_actor_role:        event.actorRole,
    p_subject_client_id: event.subjectClientId  ?? null,
    p_resource_type:     event.resourceType,
    p_resource_id:       event.resourceId       ?? null,
    p_action:            event.action,
    p_access_basis:      event.actorRole,
    p_reason:            event.reason           ?? null,
    p_request_id:        requestId,
    p_outcome:           event.outcome,
    p_denial_reason:     event.denialReason     ?? null,
    p_ip_hash:           event.ipAddress ? hashValue(event.ipAddress) : null,
    p_session_id_hash:   event.sessionId  ? hashValue(event.sessionId) : null,
    p_metadata:          event.metadata         ?? {},
  }
}

/**
 * Schrijft een audit-event via de public.log_audit_event() RPC.
 * Die functie heeft SECURITY DEFINER en draait als postgres superuser,
 * waardoor hij altijd kan schrijven naar audit.vh_events.
 * Gooit nooit een fout naar de aanroeper.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  const requestId = event.requestId ?? randomUUID()
  try {
    const admin = createAdminClient()
    const { error } = await admin.rpc('log_audit_event', buildRpcParams(event, requestId))

    if (error) {
      // Fout zichtbaar maken in server logs zonder de aanroeper te blokkeren
      console.error('[audit] RPC fout:', error.code, error.message)
    }

    sendToBetterStack(event, requestId).catch(() => {})
  } catch (err) {
    console.error('[audit] Onverwachte fout:', err)
  }
}

/**
 * Blokkeert de aanroeper als de auditlog faalt.
 * Gebruik voor kritieke acties: export, download, statuswijziging.
 */
export async function logAuditEventOrThrow(event: AuditEventInput): Promise<void> {
  const requestId = event.requestId ?? randomUUID()
  const admin = createAdminClient()
  const { error } = await admin.rpc('log_audit_event', buildRpcParams(event, requestId))

  if (error) throw new Error(`Auditlog schrijven mislukt: ${error.code} — ${error.message}`)
  sendToBetterStack(event, requestId).catch(() => {})
}

// ── withAudit wrapper ─────────────────────────────────────────────────────────

/**
 * Wrapper voor kritieke acties: logt succesvol of gooit een fout als de
 * auditlog niet kan worden geschreven.
 *
 * Gebruik voor: exports, downloads, statuswijzigingen.
 * Voor gewone views: gebruik logAuditEvent() zonder throw.
 */
export async function withAudit<T>(
  event: Omit<AuditEventInput, 'outcome'>,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn()
    await logAuditEventOrThrow({ ...event, outcome: 'success' })
    return result
  } catch (err) {
    // Log de fout, maar gooi hem opnieuw
    await logAuditEvent({ ...event, outcome: 'failed' }).catch(() => {})
    throw err
  }
}
