import { createAdminClient } from '@/lib/supabase/admin'
import { ShieldCheck } from 'lucide-react'
import { format } from 'date-fns'
import { nl } from 'date-fns/locale'
import { requireRolePage } from '@/lib/auth/guard'
import { ConsentEditor } from './ConsentEditor'

export const metadata = { title: 'Toestemmingen — Vita Health' }

export default async function ToestemmingenPage() {
  await requireRolePage(['admin'])
  const admin = createAdminClient()
  const { data: versions } = await admin
    .from('vh_consent_version')
    .select('id, version, required_texts, optional_texts, is_active, created_at')
    .order('version', { ascending: false })

  const active = (versions ?? []).find(v => v.is_active) ?? (versions ?? [])[0] ?? null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-[#1f1683]" />
          <h1 className="text-2xl font-bold text-[#1e293b]">Toestemmingen beheren</h1>
        </div>
        <p className="text-sm text-[#64748b]">
          Pas de toestemmingsteksten aan. Bij publiceren wordt een nieuwe versie opgeslagen;
          eerdere versies blijven bewaard voor cliënten die daar destijds mee akkoord gingen.
        </p>
      </div>

      <ConsentEditor
        activeVersion={active?.version ?? 1}
        initialRequired={(active?.required_texts as string[]) ?? []}
        initialOptional={(active?.optional_texts as string[]) ?? []}
      />

      {/* Versiegeschiedenis */}
      {(versions ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-[#475569] mb-2">Versiegeschiedenis</h2>
          <div className="rounded-xl border border-[#e2e8f0] bg-white divide-y divide-[#f1f5f9]">
            {(versions ?? []).map(v => (
              <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[#1e293b]">v{v.version}</span>
                  {v.is_active && (
                    <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase">Actief</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                  <span>{(v.required_texts as string[]).length} verplicht · {(v.optional_texts as string[]).length} optioneel</span>
                  <span>{format(new Date(v.created_at), 'd MMM yyyy HH:mm', { locale: nl })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
