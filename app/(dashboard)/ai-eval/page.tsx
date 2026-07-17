import { requireRolePage } from '@/lib/auth/guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { caseLabel } from '@/lib/annotation'
import { getAiProvider } from '@/lib/ai'
import { anthropicProvider } from '@/lib/ai/anthropic'
import { EvalRunner } from './EvalRunner'
import { FlaskConical } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AiEvalPage() {
  await requireRolePage(['admin', 'arts', 'leefstijlarts'])
  const admin = createAdminClient()

  // Kandidaten = dossiers waarvoor een arts een advies heeft INGEDIEND.
  // Dat artsadvies is het ijkpunt waartegen we de modellen leggen.
  const { data: anns } = await admin
    .from('vh_annotation')
    .select('client_id, submitted_at')
    .eq('status', 'ingediend')
    .not('advies', 'is', null)
    .order('submitted_at', { ascending: false })

  const clientIds = [...new Set((anns ?? []).map(a => a.client_id as string))]
  const { data: clients } = clientIds.length
    ? await admin.from('vh_client').select('id, gender, birth_date').in('id', clientIds)
    : { data: [] as { id: string; gender: string | null; birth_date: string | null }[] }

  const byId = new Map((clients ?? []).map(c => [c.id, c]))
  const options = clientIds
    .map(id => {
      const c = byId.get(id)
      return { id, label: caseLabel(c?.birth_date ?? null, c?.gender ?? null) }
    })
    .filter(o => byId.has(o.id))

  const current = getAiProvider()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#1e293b]">
          <FlaskConical size={20} className="text-[#17e4a1]" />
          AI-eval
        </h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          Vergelijk modellen op jouw eigen geannoteerde casussen. Elk model krijgt exact dezelfde
          prompt en dezelfde opgehaalde kennis; het advies van de arts is het ijkpunt.
        </p>
      </div>

      <EvalRunner
        options={options}
        currentName={current.name}
        claudeName={anthropicProvider.isConfigured() ? anthropicProvider.name : null}
      />
    </div>
  )
}
