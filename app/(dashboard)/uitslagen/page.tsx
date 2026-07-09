import { requireRolePage } from '@/lib/auth/guard'
import { FlaskConical } from 'lucide-react'
import { UitslagenUploader } from './UitslagenUploader'

export const metadata = { title: 'Uitslagen inladen — Vita Health' }

export default async function UitslagenPage() {
  await requireRolePage(['arts', 'leefstijlarts'])

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1e293b] flex items-center gap-2">
          <FlaskConical size={22} className="text-[#1f1683]" />
          Uitslagen inladen
        </h1>
        <p className="text-sm text-[#64748b] mt-1 leading-relaxed">
          Sleep hier één of meer Nightingale-PDF&apos;s. Op basis van het <strong>kitnummer in de
          bestandsnaam</strong> wordt de uitslag automatisch bij de juiste cliënt in het dossier
          verwerkt (uitlezen + koppelen). Bestandsnaam: <span className="font-mono text-xs">NGH Health Check - 100400124574 - 260621.pdf</span>.
        </p>
      </div>

      <UitslagenUploader />
    </div>
  )
}
