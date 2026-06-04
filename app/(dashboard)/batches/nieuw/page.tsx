import { createClient } from '@/lib/supabase/server'
import { BatchForm } from './BatchForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NieuweBatchPage() {
  const supabase = await createClient()

  const { data: retourRaw } = await supabase
    .from('vh_testkit')
    .select('id, barcode, retour_date, vh_client(first_name, last_name), vh_company(name), vh_arbo(name)')
    .eq('status', 'retour')
    .is('batch_id', null)
    .order('retour_date', { ascending: true })

  // Plat maken voor de client component (geen serializatie-issues met geneste objecten)
  const retourKits = (retourRaw ?? []).map((kit) => {
    const c = kit.vh_client as unknown as { first_name: string; last_name: string } | null
    const co = kit.vh_company as unknown as { name: string } | null
    const a = kit.vh_arbo as unknown as { name: string } | null
    return {
      id: kit.id,
      barcode: kit.barcode,
      retour_date: kit.retour_date as string | null,
      assignedName: c
        ? `${c.first_name} ${c.last_name}`
        : co?.name ?? a?.name ?? 'Niet toegewezen',
    }
  })

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <Link href="/batches" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar batches
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Nieuwe batch aanmaken</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Selecteer de retour-testkits, voer het NH Badge ID in en registreer de verzending.
        </p>
      </div>
      <BatchForm retourKits={retourKits} />
    </div>
  )
}
