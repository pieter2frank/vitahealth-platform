import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/validation'
import { logAuditEvent } from '@/lib/audit'
import { pdfToPageLines } from '@/lib/reports/pdf-text'
import { parseNightingaleReport } from '@/lib/reports/nightingale'

// POST /api/reports/parse  { documentId }
// Leest een opgeslagen Nightingale-rapport (PDF) uit en slaat de waarden
// gestructureerd op (vh_report*) met parse_status = 'needs_review'.
// Alleen arts/leefstijlarts; elke verwerking wordt in de auditlog vastgelegd.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Niet geautoriseerd.' }, { status: 401 })

  const admin = createAdminClient()

  // Rol-controle: alleen arts/leefstijlarts mag medische data verwerken.
  const { data: me } = await admin
    .from('vh_medewerker').select('role').eq('user_id', user.id).maybeSingle()
  if (!me || !['arts', 'leefstijlarts'].includes(me.role)) {
    return NextResponse.json({ error: 'Alleen voor arts/leefstijlarts.' }, { status: 403 })
  }

  const { documentId } = await req.json().catch(() => ({}))
  if (!isUuid(documentId)) return NextResponse.json({ error: 'Ongeldig documentId.' }, { status: 400 })

  const { data: doc } = await admin
    .from('vh_client_document')
    .select('id, client_id, filename, storage_path')
    .eq('id', documentId)
    .single()
  if (!doc?.client_id) return NextResponse.json({ error: 'Document niet gevonden.' }, { status: 404 })

  // PDF uit private bucket downloaden
  const { data: file, error: dlErr } = await admin.storage
    .from('client-documents').download(doc.storage_path)
  if (dlErr || !file) return NextResponse.json({ error: 'Rapport kon niet worden geladen.' }, { status: 500 })

  // Extractie + parsing
  let parsed
  try {
    const pages = await pdfToPageLines(new Uint8Array(await file.arrayBuffer()))
    parsed = parseNightingaleReport(pages)
  } catch (e) {
    return NextResponse.json(
      { error: 'PDF kon niet worden verwerkt: ' + (e instanceof Error ? e.message : 'onbekende fout') },
      { status: 500 },
    )
  }

  if (parsed.diseases.length === 0 && parsed.biomarkers.length === 0) {
    return NextResponse.json({ error: 'Niet herkend als Nightingale-rapport.' }, { status: 422 })
  }

  // ── Opslaan (idempotent: 1 rapport per document) ────────────────────────────
  const { data: rep, error: repErr } = await admin
    .from('vh_report')
    .upsert({
      client_id:             doc.client_id,
      document_id:           doc.id,
      source:                'nightingale',
      sample_id:             parsed.meta.sampleId,
      sample_date:           parsed.meta.sampleDate,
      sex:                   parsed.meta.sex,
      age:                   parsed.meta.age,
      metabolic_age:         parsed.scores.metabolicAge,
      resilience_score:      parsed.scores.resilienceScore,
      resilience_percentile: parsed.scores.resiliencePercentile,
      resilience_category:   parsed.scores.resilienceCategory,
      parse_status:          'needs_review',
      parsed_at:             new Date().toISOString(),
      raw_json:              parsed,
    }, { onConflict: 'document_id' })
    .select('id')
    .single()

  if (repErr || !rep) {
    return NextResponse.json({ error: 'Opslaan mislukt: ' + (repErr?.message ?? '') }, { status: 500 })
  }

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
      report_id:   rep.id,
      marker_code: b.markerCode,
      value:       b.value,
      unit:        b.unit,
      ref_optimal: b.refOptimal,
      association: b.association,
    })))
  }

  await logAuditEvent({
    actorUserId:     user.id,
    actorRole:       'medisch_deskundige',
    subjectClientId: doc.client_id,
    resourceType:    'client_document',
    resourceId:      doc.id,
    action:          'create',
    outcome:         'success',
    reason:          `Rapport uitgelezen (${parsed.biomarkers.length} markers, ${parsed.diseases.length} ziekterisico's)`,
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    reportId: rep.id,
    summary: {
      sampleId:    parsed.meta.sampleId,
      sampleDate:  parsed.meta.sampleDate,
      metabolicAge: parsed.scores.metabolicAge,
      resilienceScore: parsed.scores.resilienceScore,
      diseases:    parsed.diseases.length,
      biomarkers:  parsed.biomarkers.length,
    },
    warnings: parsed.warnings,
  })
}
