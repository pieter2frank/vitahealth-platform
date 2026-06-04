import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { isUuid } from '@/lib/validation'
import type { Client } from '@/types'
import { logAuditEventOrThrow } from '@/lib/audit'

function calcAge(birthDate: string | null): number | string {
  if (!birthDate) return ''
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

const GENDER_LABELS: Record<string, string> = {
  man:             'Man',
  vrouw:           'Vrouw',
  anders:          'Anders',
  zeg_liever_niet: 'Zeg ik liever niet',
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
    .select('id, barcode, vh_client(id, birth_date)')
    .eq('batch_id', id)
    .order('barcode', { ascending: true })

  const clientIds = (kits ?? [])
    .map(k => (k.vh_client as unknown as Pick<Client, 'id' | 'birth_date'> | null)?.id)
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
    const client    = kit.vh_client as unknown as Pick<Client, 'id' | 'birth_date'> | null
    const resp      = client ? responseMap.get(client.id) : null
    const genderRaw = resp?.d1_geslacht as string | undefined

    return {
      'Batch ID': batch.badge_id,
      'Kit ID':   kit.barcode,
      'Leeftijd': client ? calcAge(client.birth_date) : '',
      'Geslacht': genderRaw ? (GENDER_LABELS[genderRaw] ?? genderRaw) : '',
    }
  })

  // 5. Excel aanmaken
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 20 }, // Batch ID
    { wch: 20 }, // Kit ID
    { wch: 12 }, // Leeftijd
    { wch: 22 }, // Geslacht
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, batch.badge_id)

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
