import { createAdminClient } from '@/lib/supabase/admin'
import { requireRolePage } from '@/lib/auth/guard'
import { Store } from 'lucide-react'
import { ResellersManager, type ResellerRow } from './ResellersManager'

// Reseller-beheer (overzicht + aanmaken). Alleen admin.
export default async function ResellersPage() {
  await requireRolePage(['admin'])

  const admin = createAdminClient()
  const [{ data: resellers }, { data: codes }, { data: orders }] = await Promise.all([
    admin.from('vh_reseller')
      .select('id, name, contact_person, email, phone, city, active, created_at')
      .order('created_at', { ascending: false }),
    admin.from('vh_discount_code').select('reseller_id'),
    admin.from('vh_order').select('reseller_id, status, amount_cents, vat_cents').not('reseller_id', 'is', null),
  ])

  // Aantal gekoppelde codes per reseller.
  const codeCount = new Map<string, number>()
  for (const c of codes ?? []) {
    const rid = c.reseller_id as string | null
    if (rid) codeCount.set(rid, (codeCount.get(rid) ?? 0) + 1)
  }

  // Omzet per reseller uit betaalde orders (terugbetaalde vallen buiten 'paid').
  const agg = new Map<string, { used: number; gross: number; net: number }>()
  for (const o of orders ?? []) {
    if (o.status !== 'paid') continue
    const rid = o.reseller_id as string
    const cur = agg.get(rid) ?? { used: 0, gross: 0, net: 0 }
    cur.used += 1
    cur.gross += (o.amount_cents as number) ?? 0
    cur.net += ((o.amount_cents as number) ?? 0) - ((o.vat_cents as number) ?? 0)
    agg.set(rid, cur)
  }

  const rows: ResellerRow[] = (resellers ?? []).map(r => {
    const a = agg.get(r.id as string)
    return {
      id:            r.id as string,
      name:          r.name as string,
      contactPerson: (r.contact_person as string | null) ?? null,
      email:         (r.email as string | null) ?? null,
      phone:         (r.phone as string | null) ?? null,
      city:          (r.city as string | null) ?? null,
      active:        Boolean(r.active),
      codeCount:     codeCount.get(r.id as string) ?? 0,
      usedCount:     a?.used ?? 0,
      grossCents:    a?.gross ?? 0,
      netCents:      a?.net ?? 0,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4ff]">
          <Store size={20} className="text-[#1f1683]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1e293b]">Resellers</h1>
          <p className="text-sm text-[#64748b]">Partners die via een eigen kortingscode klanten werven.</p>
        </div>
      </div>

      <ResellersManager rows={rows} />
    </div>
  )
}
