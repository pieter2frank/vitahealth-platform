import { ShieldAlert } from 'lucide-react'

// Geen guard: deze pagina is het eindpunt van een geweigerde toegang.
export default function GeenToegang() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-xl border border-[#e2e8f0] bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <ShieldAlert size={22} className="text-red-500" />
      </div>
      <h1 className="text-lg font-semibold text-[#1e293b]">Geen toegang</h1>
      <p className="mt-1.5 text-sm text-[#64748b]">
        De annotatiemodule is uitsluitend beschikbaar voor het medisch team (arts / leefstijlarts).
      </p>
    </div>
  )
}
