import { createAdminClient } from '@/lib/supabase/admin'
import { requireRolePage } from '@/lib/auth/guard'
import { isUuid } from '@/lib/validation'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ResellerDetail, type ResellerData, type ResellerCode, type PackageOption, type ResellerStats } from './ResellerDetail'

export default async function ResellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRolePage(['admin'])
  const { id } = await params
  if (!isUuid(id)) notFound()

  const admin = createAdminClient()
  const [{ data: reseller }, { data: codes }, { data: packages }, { data: orders }] = await Promise.all([
    admin.from('vh_reseller')
      .select('id, name, contact_person, email, phone, address, postal_code, city, kvk, note, active')
      .eq('id', id).maybeSingle(),
    admin.from('vh_discount_code')
      .select('id, code, type, value, package_id, max_uses, used_count, valid_until, active')
      .eq('reseller_id', id).order('created_at', { ascending: false }),
    admin.from('vh_package').select('id, name').order('sort_order', { ascending: true }),
    admin.from('vh_order').select('status, amount_cents, vat_cents, discount_cents').eq('reseller_id', id),
  ])

  if (!reseller) notFound()

  // Cijfers: betaalde orders tellen (terugbetaalde vallen buiten 'paid').
  const stats: ResellerStats = { usedCount: 0, grossCents: 0, netCents: 0, discountCents: 0, refundCount: 0, refundGrossCents: 0 }
  for (const o of orders ?? []) {
    const amount = (o.amount_cents as number) ?? 0
    const vat = (o.vat_cents as number) ?? 0
    if (o.status === 'paid') {
      stats.usedCount += 1
      stats.grossCents += amount
      stats.netCents += amount - vat
      stats.discountCents += (o.discount_cents as number) ?? 0
    } else if (o.status === 'refunded') {
      stats.refundCount += 1
      stats.refundGrossCents += amount
    }
  }

  const data: ResellerData = {
    id:            reseller.id as string,
    name:          reseller.name as string,
    contactPerson: (reseller.contact_person as string | null) ?? '',
    email:         (reseller.email as string | null) ?? '',
    phone:         (reseller.phone as string | null) ?? '',
    address:       (reseller.address as string | null) ?? '',
    postalCode:    (reseller.postal_code as string | null) ?? '',
    city:          (reseller.city as string | null) ?? '',
    kvk:           (reseller.kvk as string | null) ?? '',
    note:          (reseller.note as string | null) ?? '',
    active:        Boolean(reseller.active),
  }
  const codeRows: ResellerCode[] = (codes ?? []).map(c => ({
    id:         c.id as string,
    code:       c.code as string,
    type:       c.type as 'percent' | 'fixed',
    value:      c.value as number,
    packageId:  (c.package_id as string | null) ?? null,
    maxUses:    (c.max_uses as number | null) ?? null,
    usedCount:  (c.used_count as number) ?? 0,
    validUntil: (c.valid_until as string | null) ?? null,
    active:     Boolean(c.active),
  }))
  const pkgOptions: PackageOption[] = (packages ?? []).map(p => ({ id: p.id as string, name: p.name as string }))

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/resellers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b]">
        <ArrowLeft size={14} /> Terug naar resellers
      </Link>
      <ResellerDetail data={data} codes={codeRows} packages={pkgOptions} stats={stats} />
    </div>
  )
}
