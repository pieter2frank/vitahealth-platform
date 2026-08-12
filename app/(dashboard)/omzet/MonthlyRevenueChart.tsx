'use client'
import { useState } from 'react'
import { formatEuro } from '@/lib/payments/pricing'

// Lichte, dependency-vrije staafgrafiek (SVG). Toont omzet per maand met een
// tooltip bij hover. Bewust eenvoudig gehouden — past bij de rest van de app.
export function MonthlyRevenueChart({ data }: { data: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)

  const W = 720, H = 240
  const padL = 8, padR = 8, padT = 24, padB = 28
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const max = Math.max(1, ...data.map(d => d.value))
  // Nette bovengrens (afronden naar boven op een ronde waarde).
  const niceMax = niceCeil(max)
  const colW = plotW / data.length
  const barW = Math.min(46, colW * 0.6)

  const yFor = (v: number) => padT + plotH - (v / niceMax) * plotH
  const gridVals = [0, niceMax / 2, niceMax]

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }} role="img" aria-label="Omzet per maand">
        {/* Gridlijnen + y-labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={yFor(gv)} x2={W - padR} y2={yFor(gv)} stroke="#f1f5f9" strokeWidth={1} />
            <text x={padL} y={yFor(gv) - 4} fill="#cbd5e1" fontSize={10}>{compactEuro(gv)}</text>
          </g>
        ))}

        {/* Staven */}
        {data.map((d, i) => {
          const x = padL + i * colW + (colW - barW) / 2
          const y = yFor(d.value)
          const h = padT + plotH - y
          const active = hover === i
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* onzichtbare hover-zone over de volledige kolom */}
              <rect x={padL + i * colW} y={padT} width={colW} height={plotH} fill="transparent" />
              <rect
                x={x} y={y} width={barW} height={Math.max(0, h)} rx={4}
                fill={active ? '#17e4a1' : '#1f1683'}
                style={{ transition: 'fill .12s' }}
              />
              <text x={x + barW / 2} y={H - padB + 16} textAnchor="middle" fill="#94a3b8" fontSize={11}>{d.label}</text>
              {active && d.value > 0 && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#1e293b" fontSize={11} fontWeight={700}>
                  {formatEuro(d.value)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Ronde bovengrens voor de y-as (1-2-5 × 10ⁿ), zodat de schaal netjes oogt.
function niceCeil(v: number): number {
  if (v <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return step * pow
}

// Compacte euro-weergave voor de as (€ 1,2k).
function compactEuro(cents: number): string {
  const e = cents / 100
  if (e >= 1000) return '€ ' + (e / 1000).toFixed(e >= 10000 ? 0 : 1).replace('.', ',') + 'k'
  return '€ ' + Math.round(e)
}
