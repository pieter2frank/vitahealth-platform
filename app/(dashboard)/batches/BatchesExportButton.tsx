'use client'
import { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'

export function BatchesExportButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleExport() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/export/batches')
      if (!res.ok) { setError('Export mislukt.'); return }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')

      // Bestandsnaam uit Content-Disposition header lezen indien aanwezig
      const cd       = res.headers.get('Content-Disposition') ?? ''
      const match    = cd.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : 'batches-export.xlsx'
      a.href     = url
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Er is een fout opgetreden bij het exporteren.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? <><Loader2 size={15} className="animate-spin" /> Exporteren…</>
          : <><FileSpreadsheet size={15} className="text-green-600" /> Exporteer Excel</>
        }
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
