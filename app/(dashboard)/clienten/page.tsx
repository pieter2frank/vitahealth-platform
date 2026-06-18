import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { UserPlus, Search, Send } from 'lucide-react'
import { ClientsTable } from './ClientsTable'

export default async function ClientenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q, status } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('vh_client')
    .select('id, first_name, last_name, email, phone, city, created_at, enrollment_status')
    .order('last_name', { ascending: true })

  if (q) {
    query = query.or(`last_name.ilike.%${q}%,first_name.ilike.%${q}%,email.ilike.%${q}%`)
  }

  const { data: clients, error } = await query

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1e293b]">Cliënten</h1>
          <p className="text-sm text-[#64748b] mt-0.5">
            {clients?.length ?? 0} cliënt{(clients?.length ?? 0) !== 1 ? 'en' : ''} gevonden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/uitnodigen"
            className="inline-flex items-center gap-2 rounded-lg border border-[#1f1683] bg-white px-4 py-2 text-sm font-medium text-[#1f1683] hover:bg-[#eef4ff] transition-colors"
          >
            <Send size={15} />
            Uitnodiging sturen
          </Link>
          <Link
            href="/clienten/nieuw"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            <UserPlus size={16} />
            Nieuwe cliënt
          </Link>
        </div>
      </div>

      {/* Zoekbalk (server-side) */}
      <div className="mb-4">
        <form method="GET" className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Zoek op naam of e-mail..."
              className="h-9 w-full rounded-lg border border-[#e2e8f0] bg-white pl-9 pr-3 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
            />
          </div>
        </form>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#e2e8f0] bg-white px-5 py-8 text-center text-sm text-red-500 shadow-sm">
          Fout bij ophalen cliënten.
        </div>
      ) : (
        <ClientsTable clients={clients ?? []} initialStatus={status} />
      )}
    </div>
  )
}
