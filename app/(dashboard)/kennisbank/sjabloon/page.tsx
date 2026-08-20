import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireRolePage } from '@/lib/auth/guard'
import { getAdviceTemplate, DEFAULT_TEMPLATE } from '@/lib/ai/advice'
import { TemplateEditor } from './TemplateEditor'

// Beheer van het adviessjabloon: de vaste structuur waarin elk AI-conceptadvies
// wordt gegoten. Opgeslagen in vh_ai_setting; de code-standaard is de fallback.

export const dynamic = 'force-dynamic'

export default async function AdviceTemplatePage() {
  await requireRolePage(['admin', 'arts', 'leefstijlarts'])
  const current = await getAdviceTemplate()

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/kennisbank" className="mb-2 inline-flex items-center gap-1.5 text-xs text-[#64748b] hover:text-[#1f1683]">
          <ArrowLeft size={13} /> Kennisbank
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Adviessjabloon</h1>
        <p className="mt-0.5 text-sm text-[#64748b]">
          De vaste structuur waarin elk AI-conceptadvies wordt gegoten. Het model moet dit sjabloon
          exact volgen en de rubric-beoordelaar in de AI-eval toetst ertegen.
        </p>
      </div>
      <TemplateEditor current={current} isDefault={current === DEFAULT_TEMPLATE} defaultTemplate={DEFAULT_TEMPLATE} />
    </div>
  )
}
