import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { isUuid } from '@/lib/validation'
import type { Client } from '@/types'
import { logAuditEventOrThrow } from '@/lib/audit'

function formatDob(birthDate: string | null): string {
  if (!birthDate) return ''
  // Parse de datumdelen direct (tijdzone-onafhankelijk) uit "YYYY-MM-DD".
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

// Geslacht naar Nightingale-codering: m (male), f (female), o (other).
const GENDER_CODE: Record<string, string> = {
  man:             'm',
  vrouw:           'f',
  anders:          'o',
  zeg_liever_niet: 'o',
}

/**
 * Maakt een geldige Excel-tabbladnaam: Excel staat de tekens \ / ? * [ ] : niet
 * toe en beperkt de naam tot 31 tekens. De echte badge_id blijft in de kolom
 * "Batch ID" staan; dit raakt alleen de naam van het werkblad.
 */
function safeSheetName(name: string): string {
  const cleaned = (name || 'Batch').replace(/[\\/?*[\]:]/g, '-').slice(0, 31).trim()
  return cleaned || 'Batch'
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return new Response('Ongeldig batch ID', { status: 400 })

  const supabase = await createClient()

  // Medewerker identificeren voor auditlog
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Niet geautoriseerd', { status: 401 })

  // 1. Batch ophalen
  const { data: batch } = await supabase
    .from('vh_batch')
    .select('id, badge_id')
    .eq('id', id)
    .single()

  if (!batch) return new Response('Batch niet gevonden', { status: 404 })

  // 2. Kits in deze batch met cliëntgegevens
  const { data: kits } = await supabase
    .from('vh_testkit')
    .select('id, barcode, sample_date, vh_client(id, birth_date, gender)')
    .eq('batch_id', id)
    .order('barcode', { ascending: true })

  const clientIds = (kits ?? [])
    .map(k => (k.vh_client as unknown as Pick<Client, 'id' | 'birth_date' | 'gender'> | null)?.id)
    .filter((cid): cid is string => !!cid)

  // 3. Meest recente vragenlijstrespons per cliënt
  const responseMap = new Map<string, Record<string, unknown>>()
  if (clientIds.length > 0) {
    const { data: responses } = await supabase
      .from('vh_questionnaire_response')
      .select('client_id, responses, completed_at')
      .in('client_id', clientIds)
      .order('completed_at', { ascending: false })

    for (const r of responses ?? []) {
      if (!responseMap.has(r.client_id)) {
        responseMap.set(r.client_id, r.responses as Record<string, unknown>)
      }
    }
  }

  // 4. Rijen opbouwen
  const rows = (kits ?? []).map(kit => {
    const client    = kit.vh_client as unknown as Pick<Client, 'id' | 'birth_date' | 'gender'> | null
    const resp      = client ? responseMap.get(client.id) : null
    // Geslacht primair uit het cliëntrecord, anders uit de vragenlijst
    const genderRaw = (client?.gender ?? (resp?.d1_geslacht as string | undefined)) || ''

    return {
      'Batch ID':      batch.badge_id,
      'Kit ID':        kit.barcode,
      'Sample date':   formatDob((kit.sample_date as string | null) ?? null),
      'Date of birth': formatDob(client?.birth_date ?? null),
      'Sex':           genderRaw ? (GENDER_CODE[genderRaw] ?? 'o') : '',
    }
  })

  // 5. Excel aanmaken
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 20 }, // Batch ID
    { wch: 20 }, // Kit ID
    { wch: 14 }, // Sample date
    { wch: 14 }, // Date of birth
    { wch: 10 }, // Sex
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(batch.badge_id))

  const rawData = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as number[]
  const blob = new Blob([new Uint8Array(rawData)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const filename = `batch-${batch.badge_id}.xlsx`

  // ── Auditlog: blokkerend — export mag niet zonder log ──────────────────────
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? ''
  await logAuditEventOrThrow({
    actorUserId:    user.id,
    actorRole:      'medewerker_regulier',
    resourceType:   'batch_export',
    resourceId:     id,
    action:         'export',
    outcome:        'success',
    reason:         `Batch ${batch.badge_id} geëxporteerd naar Excel`,
    ipAddress:      ip,
    metadata:       { batch_id: id, badge_id: batch.badge_id, kit_count: (kits ?? []).length },
  })

  return new Response(blob, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
