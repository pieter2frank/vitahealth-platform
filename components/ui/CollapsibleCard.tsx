'use client'
import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

// Herbruikbare in-/uitklapbare dossierkaart. Volgt het patroon dat ReportSection
// al gebruikte: chevron rechts, rand onder de header alleen als hij open staat.
//
// `actions` staat NAAST de klikbare titel (dus buiten de <button>), zodat knoppen
// in de header niet per ongeluk in-/uitklappen. Children worden alleen gerenderd
// als de kaart open is; server-gerenderde children mogen gewoon meegegeven worden.

interface Props {
  title:            ReactNode
  icon?:            ReactNode
  actions?:         ReactNode
  defaultOpen?:     boolean
  className?:       string
  headerClassName?: string
  children:         ReactNode
}

export function CollapsibleCard({
  title, icon, actions, defaultOpen = true, className = '', headerClassName = '', children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden ${className}`}>
      <div className={`flex items-center gap-3 px-5 py-4 ${open ? 'border-b border-[#e2e8f0]' : ''} ${headerClassName}`}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
        >
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#1e293b]">
            {icon}
            {title}
          </h2>
          <ChevronDown size={16} className={`shrink-0 text-[#94a3b8] transition-transform ${open ? '' : '-rotate-90'}`} />
        </button>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {open && children}
    </div>
  )
}
