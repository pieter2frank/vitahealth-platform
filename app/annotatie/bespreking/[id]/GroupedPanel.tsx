'use client'
import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react'

// Casuspaneel voor het MDO-dashboard: items gegroepeerd (vragenlijstcategorie
// of fysiologisch systeem), standaard gefilterd op wat aandacht vraagt.
// Groene waarden worden samengevat tot één regel; "Toon alles" klapt ze uit.

type ItemStatus = 'good' | 'warn' | 'alert' | 'neutral'
export interface PanelItem { text: string; status: ItemStatus; group?: string }

const DOT: Record<ItemStatus, string> = {
  good: 'bg-emerald-500', warn: 'bg-amber-500', alert: 'bg-red-500', neutral: 'bg-[#cbd5e1]',
}

export function GroupedPanel({ title, items, presentation }: {
  title: string
  items: PanelItem[]
  presentation: boolean
}) {
  const [showAll, setShowAll] = useState(false)

  const goodCount = items.filter(i => i.status === 'good').length
  const visible = showAll ? items : items.filter(i => i.status !== 'good')

  // Groepen in volgorde van eerste voorkomen.
  const groups: { name: string; items: PanelItem[] }[] = []
  const byName = new Map<string, PanelItem[]>()
  for (const it of visible) {
    const name = it.group ?? ''
    if (!byName.has(name)) { const list: PanelItem[] = []; byName.set(name, list); groups.push({ name, items: list }) }
    byName.get(name)!.push(it)
  }

  const itemCls = presentation ? 'text-[16px] leading-relaxed' : 'text-[13.5px] leading-snug'
  const groupCls = presentation ? 'text-[13px]' : 'text-[11px]'

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-2.5">
        <h3 className={`font-semibold text-[#1e293b] ${presentation ? 'text-[15px]' : 'text-[13px]'}`}>{title}</h3>
        <button onClick={() => setShowAll(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px] font-medium text-[#64748b] hover:bg-[#f8fafc]">
          {showAll ? <EyeOff size={11} /> : <Eye size={11} />}
          {showAll ? 'Alleen aandacht' : 'Toon alles'}
        </button>
      </div>
      <div className="px-4 py-3">
        {groups.length === 0 && (
          <p className={`text-[#94a3b8] ${itemCls}`}>Geen aandachtspunten.</p>
        )}
        {groups.map(g => (
          <div key={g.name || '_'} className="mb-2.5 last:mb-0">
            {g.name && (
              <p className={`mb-1 font-semibold uppercase tracking-wide text-[#94a3b8] ${groupCls}`}>
                {g.name}
                {g.items.some(i => i.status === 'alert') && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-red-700">alert</span>}
              </p>
            )}
            <ul>
              {g.items.map((it, i) => (
                <li key={i} className={`mb-1 flex items-start gap-2 text-[#334155] ${itemCls}`}>
                  <span className={`mt-[0.5em] h-2 w-2 shrink-0 rounded-full ${DOT[it.status]}`} />
                  <span className={it.status === 'alert' ? 'font-medium text-[#7f1d1d]' : it.status === 'warn' ? 'text-[#78350f]' : ''}>{it.text}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!showAll && goodCount > 0 && (
          <p className={`mt-2 flex items-center gap-1.5 border-t border-[#f1f5f9] pt-2 text-[#0d7a5f] ${presentation ? 'text-[14px]' : 'text-[12px]'}`}>
            <CheckCircle2 size={presentation ? 15 : 13} /> {goodCount} {goodCount === 1 ? 'waarde' : 'waarden'} in orde — verborgen
          </p>
        )}
      </div>
    </div>
  )
}
