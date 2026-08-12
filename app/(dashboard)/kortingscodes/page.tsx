import { createAdminClient } from '@/lib/supabase/admin'
import { requireRolePage } from '@/lib/auth/guard'
import { BadgePercent } from 'lucide-react'
import { DiscountCodesManager, type CodeRow, type PackageOption } from './DiscountCodesManager'

// Kortingscode-beheer: aanmaken, activeren/deactiveren en verwijderen. Alleen admin.
export default async function KortingscodesPage() {
  await requireRolePage(['admin'])

  const admin = createAdminClient()
  const [{ data: codes }, { data: packages }] = await Promise.all([
    admin.from('vh_discount_code')
      .select('id, code, type, value, package_id, max_uses, used_count, valid_until, active, note, created_at')
      .order('created_at', { ascending: false }),
    admin.from('vh_package').select('id, name').order('sort_order', { ascending: true }),
  ])

  const pkgOptions: PackageOption[] = (packages ?? []).map(p => ({ id: p.id as string, name: p.name as string }))
  const pkgName = new Map(pkgOptions.map(p => [p.id, p.name]))

  const rows: CodeRow[] = (codes ?? []).map(c => ({
    id:          c.id as string,
    code:        c.code as string,
    type:        c.type as 'percent' | 'fixed',
    value:       c.value as number,
    packageId:   (c.package_id as string | null) ?? null,
    packageName: c.package_id ? (pkgName.get(c.package_id as string) ?? '—') : null,
    maxUses:     (c.max_uses as number | null) ?? null,
    usedCount:   (c.used_count as number) ?? 0,
    validUntil:  (c.valid_until as string | null) ?? null,
    active:      Boolean(c.active),
    note:        (c.note as string | null) ?? null,
  }))

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff]">
          <BadgePercent size={20} className="text-[#1f1683]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1e293b]">Kortingscodes</h1>
          <p className="text-sm text-[#64748b]">Maak en beheer kortingscodes voor de bestelpagina.</p>
        </div>
      </div>

      <DiscountCodesManager rows={rows} packages={pkgOptions} />
    </div>
  )
}
