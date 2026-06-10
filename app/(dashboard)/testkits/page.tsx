import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, ScanLine } from 'lucide-react'
import { TestkitsTable, type KitRow } from './TestkitsTable'
import { KitScanSearch } from './KitScanSearch'

export default async function TestkitsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('vh_testkit')
    .select('id, barcode, date, status, assigned, vh_client(first_name, last_name), vh_company(name), vh_arbo(name)')
    .order('date', { ascending: false })

  if (status) query = query.eq('status', status)
  if (q)      query = query.ilike('barcode', `%${q}%`)

  const { data: rawKits, error } = await query

  const kits: KitRow[] = (rawKits ?? []).map(kit => ({
    id:         kit.id,
    barcode:    kit.barcode,
    date:       kit.date,
    status:     kit.status,
    assigned:   kit.assigned,
    assignedTo: (kit.vh_client as unknown as { first_name: string; last_name: string } | null)
      ? `${(kit.vh_client as unknown as { first_name: string; last_name: string }).first_name} ${(kit.vh_client as unknown as { first_name: string; last_name: string }).last_name}`
      : (kit.vh_company as unknown as { name: string } | null)?.name
      ?? (kit.vh_arbo    as unknown as { name: string } | null)?.name
      ?? '—',
  }))

  const STATUS_FILTERS = [
    { key: 'received',          label: 'Ontvangen' },
    { key: 'assigned',          label: 'Toegewezen' },
    { key: 'kit_verstuurd',     label: 'Verstuurd naar cliënt' },
    { key: 'retour',            label: 'Retour' },
    { key: 'sent_nightingale',  label: 'Verzonden NHG' },
    { key: 'results_available', label: 'Resultaten' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Testkits</h1>
          <p className="text-sm text-[#64748b] mt-0.5">Overzicht van alle testkits.</p>
        </div>
        <Link
          href="/testkits/intake"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
        >
          <ScanLine size={16} />
          Testkit inscannen
        </Link>
      </div>

      {/* Scan-zoekveld: barcode inscannen → direct naar de juiste kit */}
      <KitScanSearch />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterLink href="/testkits" label="Alle" active={!status} />
        {STATUS_FILTERS.map(({ key, label }) => (
          <FilterLink key={key} href={`/testkits?status=${key}`} label={label} active={status === key} />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        {error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">
            Fout bij ophalen testkits. Controleer je database verbinding.
          </div>
        ) : kits.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#94a3b8] mb-3">Geen testkits gevonden.</p>
            <Link
              href="/testkits/intake"
              className="inline-flex items-center gap-1.5 text-sm text-[#1f1683] hover:underline"
            >
              <Plus size={14} />
              Eerste kit inscannen
            </Link>
          </div>
        ) : (
          <TestkitsTable kits={kits} />
        )}
      </div>
    </div>
  )
}

function FilterLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
        active
          ? 'bg-[#1f1683] text-white border-[#1f1683]'
          : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1f1683] hover:text-[#1f1683]'
      }`}
    >
      {label}
    </Link>
  )
}
