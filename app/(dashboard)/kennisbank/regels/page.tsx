import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireRolePage } from '@/lib/auth/guard'
import { RulesManager } from './RulesManager'

// Beheer van als-dan richtlijnen voor de adviesgeneratie (vh_advice_rule).
// De condities worden deterministisch geëvalueerd (lib/ai/rules.ts); matchende
// instructies gaan verplicht mee in de adviesprompt.

export const dynamic = 'force-dynamic'

export default async function AdviceRulesPage() {
  await requireRolePage(['admin', 'arts', 'leefstijlarts'])
  const supabase = await createClient()

  const [{ data: rules }, { data: refs }, { data: q }] = await Promise.all([
    supabase.from('vh_advice_rule')
      .select('id, name, active, domain, conditions, instruction, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('vh_biomarker_ref').select('code, display_name').order('display_name'),
    supabase.from('vh_questionnaire')
      .select('json_content').eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  interface Q { id: string; type: string; label: string; options?: { value: string; label: string }[] }
  const questions = (((q?.json_content as { questions?: Q[] } | null)?.questions) ?? [])
    .filter(x => ['scale', 'rating_10', 'boolean', 'radio', 'select'].includes(x.type))
    .map(x => ({ id: x.id, type: x.type, label: x.label, options: x.options ?? [] }))

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/kennisbank" className="mb-2 inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#1f1683]">
          <ArrowLeft size={13} /> Kennisbank
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Als-dan richtlijnen</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          Beslisregels van de arts: als de condities kloppen, gaat de instructie verplicht mee in het AI-conceptadvies.
          De toepassing is deterministisch en wordt bij elk advies vastgelegd.
        </p>
      </div>
      <RulesManager
        initialRules={(rules ?? []) as never[]}
        biomarkers={(refs ?? []) as { code: string; display_name: string }[]}
        questions={questions}
      />
    </div>
  )
}
