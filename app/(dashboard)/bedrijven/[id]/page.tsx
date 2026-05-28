import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate, formatDateTime, STATUS_LABELS, STATUS_COLORS } from '@/lib/utils'
import { ArrowLeft, Pencil, TestTube2, Building2, Phone, Mail, MapPin, Hash } from 'lucide-react'
import { EditCompanyForm } from './EditCompanyForm'
import { DeleteButton } from '@/components/ui/DeleteButton'

export default async function BedrijfDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ bewerken?: string }>
}) {
  const { id } = await params
  const { bewerken } = await searchParams
  const supabase = await createClient()

  const { data: company } = await supabase.from('vh_company').select('*').eq('id', id).single()
  if (!company) notFound()

  const { data: testkits } = await supabase
    .from('vh_testkit')
    .select('id, barcode, date, status, retour_date')
    .eq('assigned_company_id', id)
    .order('date', { ascending: false })

  if (bewerken === '1') return <EditCompanyForm company={company} />

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <Link href="/bedrijven" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar bedrijven
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1e293b]">{company.name}</h1>
            <p className="text-sm text-[#64748b] mt-0.5">Aangemaakt op {formatDate(company.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/bedrijven/${id}?bewerken=1`}
              className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
            >
              <Pencil size={14} />
              Bewerken
            </Link>
            <DeleteButton
              table="vh_company"
              id={company.id}
              redirectTo="/bedrijven"
              entityLabel={company.name}
              blockedMessage={
                testkits && testkits.length > 0
                  ? `Er ${testkits.length === 1 ? 'is' : 'zijn'} ${testkits.length} testkit${testkits.length === 1 ? '' : 's'} gekoppeld aan dit bedrijf. Ontkoppel of verwijder de testkits eerst voordat je het bedrijf verwijdert.`
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <Building2 size={15} className="text-[#94a3b8]" />
            Bedrijfsgegevens
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Naam</dt>
              <dd className="font-medium text-[#1e293b]">{company.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><Hash size={13} />KVK</dt>
              <dd className="font-medium text-[#1e293b]">{company.kvk ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b]">Contactpersoon</dt>
              <dd className="font-medium text-[#1e293b]">{company.contact_name ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
            <Phone size={15} className="text-[#94a3b8]" />
            Contactgegevens
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><Mail size={13} />E-mail</dt>
              <dd className="font-medium text-[#1e293b]">{company.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><Phone size={13} />Telefoon</dt>
              <dd className="font-medium text-[#1e293b]">{company.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#64748b] flex items-center gap-1.5"><MapPin size={13} />Adres</dt>
              <dd className="font-medium text-[#1e293b] text-right">
                {company.address ? <>{company.address}<br />{company.postal_code} {company.city}</> : '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
            <TestTube2 size={15} className="text-[#94a3b8]" />
            Testkits ({testkits?.length ?? 0})
          </h2>
          <Link href={`/testkits/intake?company=${id}`} className="text-xs text-[#1f1683] hover:underline">
            + Testkit toewijzen
          </Link>
        </div>
        {!testkits || testkits.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-[#94a3b8]">Geen testkits toegewezen.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e2e8f0] bg-[#f8fafc]">
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Barcode</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Uitgifte</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Retour</th>
                <th className="px-4 py-3 text-left font-medium text-[#64748b]">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {testkits.map((kit) => (
                <tr key={kit.id} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-[#1e293b]">{kit.barcode}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDateTime(kit.date)}</td>
                  <td className="px-4 py-3 text-[#64748b]">{formatDate(kit.retour_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[kit.status as keyof typeof STATUS_COLORS]}`}>
                      {STATUS_LABELS[kit.status as keyof typeof STATUS_LABELS]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/testkits/${kit.id}`} className="text-xs text-[#1f1683] hover:underline">Details →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
