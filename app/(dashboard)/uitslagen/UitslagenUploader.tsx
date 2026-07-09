'use client'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { FileText, Loader2, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react'

interface Result {
  id: string
  filename: string
  status: 'uploading' | 'ok' | 'warn' | 'error'
  clientName?: string
  clientId?: string
  message?: string
  warnings?: string[]
  summary?: { biomarkers: number; diseases: number; resilienceScore: number | null }
}

function isPdf(f: File) { return f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') }

export function UitslagenUploader() {
  const [results, setResults] = useState<Result[]>([])
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: File[]) {
    const pdfs = files.filter(isPdf)
    if (pdfs.length === 0) return
    setBusy(true)

    for (const file of pdfs) {
      const id = crypto.randomUUID()
      setResults(prev => [{ id, filename: file.name, status: 'uploading' }, ...prev])

      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/reports/upload-by-kit', { method: 'POST', body: fd })
        const data = await res.json().catch(() => ({}))

        if (!res.ok || !data.ok) {
          setResults(prev => prev.map(r => r.id === id ? {
            ...r, status: 'error',
            clientName: data.clientName, clientId: data.clientId,
            message: data.error ?? 'Inladen mislukt.',
          } : r))
        } else {
          const hasWarn = Array.isArray(data.warnings) && data.warnings.length > 0
          setResults(prev => prev.map(r => r.id === id ? {
            ...r,
            status: hasWarn ? 'warn' : 'ok',
            clientName: data.clientName,
            clientId: data.clientId,
            warnings: data.warnings,
            summary: {
              biomarkers: data.summary?.biomarkers ?? 0,
              diseases: data.summary?.diseases ?? 0,
              resilienceScore: data.summary?.resilienceScore ?? null,
            },
          } : r))
        }
      } catch {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status: 'error', message: 'Er ging iets mis bij het inladen.' } : r))
      }
    }
    setBusy(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { e.preventDefault(); setDragging(false) }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer select-none transition-all ${
          dragging ? 'border-[#1f1683] bg-[#eef4ff]' : 'border-[#e2e8f0] hover:border-[#1f1683]/50 hover:bg-[#fafbff]'
        }`}
      >
        <div className={`h-14 w-14 rounded-full flex items-center justify-center ${dragging ? 'bg-[#dce9ff]' : 'bg-[#f0f4ff]'}`}>
          {busy ? <Loader2 size={24} className="animate-spin text-[#1f1683]" /> : <FileText size={24} className="text-[#4f6ef7]" />}
        </div>
        <p className="text-sm font-medium text-[#1e293b]">
          {dragging ? 'Loslaten om in te laden' : 'Sleep Nightingale-PDF’s hierheen'}
        </p>
        <p className="text-xs text-[#94a3b8]">
          of <span className="text-[#1f1683] font-medium">klik om te bladeren</span> · meerdere tegelijk mag · alleen PDF · max. 20 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={e => { handleFiles(Array.from(e.target.files ?? [])); e.target.value = '' }}
        />
      </div>

      {/* Resultaten */}
      {results.length > 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden divide-y divide-[#f1f5f9]">
          {results.map(r => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 shrink-0">
                {r.status === 'uploading' && <Loader2 size={16} className="animate-spin text-[#1f1683]" />}
                {r.status === 'ok'   && <CheckCircle2 size={16} className="text-emerald-500" />}
                {r.status === 'warn' && <AlertTriangle size={16} className="text-amber-500" />}
                {r.status === 'error'&& <XCircle size={16} className="text-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1e293b] truncate">{r.filename}</p>
                {r.status === 'uploading' && <p className="text-xs text-[#94a3b8]">Inladen en verwerken…</p>}

                {(r.status === 'ok' || r.status === 'warn') && (
                  <>
                    <p className="text-xs text-[#64748b]">
                      Gekoppeld aan <span className="font-medium text-[#1e293b]">{r.clientName}</span>
                      {r.summary && <> · {r.summary.biomarkers} markers · {r.summary.diseases} risico&apos;s · score {r.summary.resilienceScore ?? '?'}</>}
                    </p>
                    {r.warnings && r.warnings.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.warnings.map((w, i) => (
                          <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <AlertTriangle size={11} className="mt-0.5 shrink-0" />{w}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}

                {r.status === 'error' && (
                  <p className="text-xs text-red-600">
                    {r.message}
                    {r.clientName && r.clientName !== '—' && <> (cliënt: {r.clientName})</>}
                  </p>
                )}
              </div>

              {r.clientId && (
                <Link
                  href={`/clienten/${r.clientId}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#1f1683] hover:underline"
                >
                  Dossier <ArrowRight size={12} />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-[#94a3b8]">
        Elke uitslag krijgt status &lsquo;controleren&rsquo; en verschijnt in het dossier ter beoordeling.
        Klopt het kitnummer niet of is de kit niet gekoppeld, dan zie je dat hierboven per bestand.
      </p>
    </div>
  )
}
