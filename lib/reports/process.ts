import type { createAdminClient } from '@/lib/supabase/admin'
import { logAuditEvent } from '@/lib/audit'
import { pdfToPageLines } from '@/lib/reports/pdf-text'
import { parseNightingaleReport } from '@/lib/reports/nightingale'

type Admin = ReturnType<typeof createAdminClient>

export interface ReportSummary {
  sampleId: string | null
  sampleDate: string | null
  metabolicAge: number | null
  resilienceScore: number | null
  diseases: number
  biomarkers: number
}

export type ProcessResult =
  | { ok: true; reportId: string; summary: ReportSummary; warnings: string[] }
  | { ok: false; status: number; error: string }

// Kit-id (≥7 cijfers) uit de bestandsnaam. Conventie:
// "NGH Health Check - <kit-id> - <yymmdd>.pdf".
export function kitIdFromFilename(filename: string): string | null {
  return filename.match(/\d{7,}/)?.[0] ?? null
}

// Leest een opgeslagen Nightingale-PDF uit en slaat de waarden gestructureerd op
// (vh_report*, parse_status 'needs_review'), koppelt de testkit, werkt cliënt- en
// kit-status bij en logt. Gedeeld door /api/reports/parse en de centrale inlaad-
// route. Server-only (pdfjs); roep aan met de admin-client (service_role).
export async function processReportDocument(
  admin: Admin, documentId: string, actorUserId: string,
): Promise<ProcessResult> {
  const { data: doc } = await admin
    .from('vh_client_document')
    .select('id, client_id, filename, storage_path')
    .eq('id', documentId)
    .single()
  if (!doc?.client_id) return { ok: false, status: 404, error: 'Document niet gevonden.' }

  // PDF uit private bucket downloaden
  const { data: file, error: dlErr } = await admin.storage
    .from('client-documents').download(doc.storage_path)
  if (dlErr || !file) return { ok: false, status: 500, error: 'Rapport kon niet worden geladen.' }

  // Extractie + parsing
  let parsed
  try {
    const pages = await pdfToPageLines(new Uint8Array(await file.arrayBuffer()))
    parsed = parseNightingaleReport(pages)
  } catch (e) {
    return { ok: false, status: 500, error: 'PDF kon niet worden verwerkt: ' + (e instanceof Error ? e.message : 'onbekende fout') }
  }

  if (parsed.diseases.length === 0 && parsed.biomarkers.length === 0) {
    return { ok: false, status: 422, error: 'Niet herkend als Nightingale-rapport.' }
  }

  // ── Kit-ID-controle (bestandsnaam vs sample-ID in rapport) ───────────────────
  const filenameKitId = kitIdFromFilename(doc.filename)
  if (filenameKitId && parsed.meta.sampleId && filenameKitId !== parsed.meta.sampleId) {
    parsed.warnings.unshift(
      `Kit-ID in de bestandsnaam (${filenameKitId}) komt niet overeen met het sample-ID in het rapport (${parsed.meta.sampleId}).`,
    )
  }

  // Testkit koppelen op basis van het sample-ID (best-effort) + cliënt-check.
  let testkitId: string | null = null
  let testkitStatus: string | null = null
  if (parsed.meta.sampleId) {
    const { data: kit } = await admin
      .from('vh_testkit').select('id, assigned_client_id, status').eq('barcode', parsed.meta.sampleId).maybeSingle()
    if (kit) {
      testkitId = kit.id
      testkitStatus = kit.status
      if (kit.assigned_client_id && kit.assigned_client_id !== doc.client_id) {
        parsed.warnings.unshift('Let op: dit kit-ID is in het systeem aan een andere cliënt gekoppeld.')
      }
    }
  }

  // ── Opslaan (idempotent: 1 rapport per document) ────────────────────────────
  const { data: rep, error: repErr } = await admin
    .from('vh_report')
    .upsert({
      client_id:             doc.client_id,
      document_id:           doc.id,
      testkit_id:            testkitId,
      source:                'nightingale',
      sample_id:             parsed.meta.sampleId,
      sample_date:           parsed.meta.sampleDate,
      sex:                   parsed.meta.sex,
      age:                   parsed.meta.age,
      metabolic_age:         parsed.scores.metabolicAge,
      resilience_score:      parsed.scores.resilienceScore,
      resilience_percentile: parsed.scores.resiliencePercentile,
      resilience_category:   parsed.scores.resilienceCategory,
      projection_age:        parsed.projectionAge,
      parse_status:          'needs_review',
      parsed_at:             new Date().toISOString(),
      warnings:              parsed.warnings,
      raw_json:              parsed,
    }, { onConflict: 'document_id' })
    .select('id')
    .single()

  if (repErr || !rep) return { ok: false, status: 500, error: 'Opslaan mislukt: ' + (repErr?.message ?? '') }

  // Kinderen vervangen
  await admin.from('vh_report_disease_risk').delete().eq('report_id', rep.id)
  await admin.from('vh_report_biomarker').delete().eq('report_id', rep.id)

  if (parsed.diseases.length) {
    await admin.from('vh_report_disease_risk').insert(parsed.diseases.map(d => ({
      report_id:          rep.id,
      disease:            d.disease,
      result_category:    d.resultCategory,
      risk_current_pct:   d.riskCurrentPct,
      risk_avg_pct:       d.riskAvgPct,
      risk_age70_pct:     d.riskAge70Pct,
      risk_age70_avg_pct: d.riskAge70AvgPct,
    })))
  }
  if (parsed.biomarkers.length) {
    await admin.from('vh_report_biomarker').insert(parsed.biomarkers.map(b => ({
      report_id:       rep.id,
      marker_code:     b.markerCode,
      value:           b.value,
      value_qualifier: b.qualifier,
      unit:            b.unit,
      ref_optimal:     b.refOptimal,
      association:     b.association,
    })))
  }

  // Cliëntstatus naar 'uitslag_bekend' zodra de uitslag is ingelezen.
  const { data: cl } = await admin
    .from('vh_client').select('enrollment_status').eq('id', doc.client_id).maybeSingle()
  if (cl && !['uitslag_bekend', 'uitslag_besproken'].includes(cl.enrollment_status)) {
    await admin.from('vh_client').update({ enrollment_status: 'uitslag_bekend' }).eq('id', doc.client_id)
    await logAuditEvent({
      actorUserId, actorRole: 'medisch_deskundige', subjectClientId: doc.client_id,
      resourceType: 'enrollment_status', resourceId: doc.client_id,
      action: 'status_change', outcome: 'success', reason: 'Uitslag ingelezen → uitslag_bekend',
    }).catch(() => {})
  }

  // Kit-status naar 'results_available' zodra de uitslag binnen is.
  let kitToUpdate = testkitId
  let kitPrevStatus = testkitStatus
  if (!kitToUpdate) {
    const { data: kits } = await admin
      .from('vh_testkit').select('id, status').eq('assigned_client_id', doc.client_id)
    const candidates = (kits ?? []).filter(k => k.status !== 'results_available')
    if (candidates.length === 1) { kitToUpdate = candidates[0].id; kitPrevStatus = candidates[0].status }
  }
  if (kitToUpdate && kitPrevStatus !== 'results_available') {
    await admin.from('vh_testkit')
      .update({ status: 'results_available', results_date: new Date().toISOString() })
      .eq('id', kitToUpdate)
    await logAuditEvent({
      actorUserId, actorRole: 'medisch_deskundige', subjectClientId: doc.client_id,
      resourceType: 'kit_status', resourceId: kitToUpdate,
      action: 'status_change', outcome: 'success', reason: 'Uitslag ingelezen → kit-status results_available',
    }).catch(() => {})
  }

  await logAuditEvent({
    actorUserId, actorRole: 'medisch_deskundige', subjectClientId: doc.client_id,
    resourceType: 'client_document', resourceId: doc.id,
    action: 'create', outcome: 'success',
    reason: `Rapport uitgelezen (${parsed.biomarkers.length} markers, ${parsed.diseases.length} ziekterisico's)`,
  }).catch(() => {})

  return {
    ok: true,
    reportId: rep.id,
    summary: {
      sampleId:        parsed.meta.sampleId,
      sampleDate:      parsed.meta.sampleDate,
      metabolicAge:    parsed.scores.metabolicAge,
      resilienceScore: parsed.scores.resilienceScore,
      diseases:        parsed.diseases.length,
      biomarkers:      parsed.biomarkers.length,
    },
    warnings: parsed.warnings,
  }
}
