import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import type { Client } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  man:            'Man',
  vrouw:          'Vrouw',
  anders:         'Anders',
  zeg_liever_niet:'Zeg ik liever niet',
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // 1. Alle batches ophalen voor badge_id lookup
  const { data: batches } = await supabase
    .from('vh_batch')
    .select('id, badge_id')

  const batchMap = new Map<string, string>(
    (batches ?? []).map(b => [b.id, b.badge_id])
  )

  // 2. Alle kits die in een batch zitten
  const { data: kits } = await supabase
    .from('vh_testkit')
    .select('id, barcode, batch_id, assigned_client_id, vh_client(id, birth_date)')
    .not('batch_id', 'is', null)
    .order('batch_id', { ascending: true })

  const clientIds = (kits ?? [])
    .map(k => (k.vh_client as Pick<Client, 'id' | 'birth_date'> | null)?.id)
    .filter((id): id is string => !!id)

  // 3. Meest recente vragenlijstrespons per cliënt ophalen
  const responseMap = new Map<string, Record<string, unknown>>()
  if (clientIds.length > 0) {
    const { data: responses } = await supabase
      .from('vh_questionnaire_response')
      .select('client_id, responses, completed_at')
      .in('client_id', clientIds)
      .order('completed_at', { ascending: false })

    for (const r of responses ?? []) {
      // Eerste treffer is de meest recente (vanwege DESC sort)
      if (!responseMap.has(r.client_id)) {
        responseMap.set(r.client_id, r.responses as Record<string, unknown>)
      }
    }
  }

  // 4. Rijen bouwen
  const rows = (kits ?? []).map(kit => {
    const client = kit.vh_client as Pick<Client, 'id' | 'birth_date'> | null
    const resp   = client ? responseMap.get(client.id) : null
    const genderRaw = resp?.d1_geslacht as string | undefined

    return {
      'Batch ID':  kit.batch_id ? (batchMap.get(kit.batch_id) ?? kit.batch_id) : '',
      'Kit ID':    kit.barcode,
      'Leeftijd':  client ? calcAge(client.birth_date) : '',
      'Geslacht':  genderRaw ? (GENDER_LABELS[genderRaw] ?? genderRaw) : '',
    }
  })

  // 5. Excel bestand genereren
  const ws = XLSX.utils.json_to_sheet(rows)

  // Kolombreedte instellen
  ws['!cols'] = [
    { wch: 20 }, // Batch ID
    { wch: 20 }, // Kit ID
    { wch: 12 }, // Leeftijd
    { wch: 22 }, // Geslacht
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Batches export')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer

  const filename = `batches-export-${new Date().toISOString().split('T')[0]}.xlsx`

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
