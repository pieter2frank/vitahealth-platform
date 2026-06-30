'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Trash2, ExternalLink, Loader2, AlertTriangle, ShieldCheck, ScanLine } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Document {
  id: string
  client_id: string
  filename: string
  storage_path: string
  file_size: number | null
  uploaded_by: string | null
  created_at: string
}

interface UploadItem {
  tempId: string
  filename: string
  error: string | null
}

interface Props {
  clientId: string
  initialDocuments: Document[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isValidPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ClientDocumentsSection({ clientId, initialDocuments }: Props) {
  const { name, email, role } = useUser()
  const [documents, setDocuments]   = useState<Document[]>(initialDocuments)
  const [uploading, setUploading]   = useState<UploadItem[]>([])
  const [dragging, setDragging]     = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmSend, setConfirmSend] = useState<string | null>(null)
  const [sendingId, setSendingId]     = useState<string | null>(null)
  const [sentIds, setSentIds]         = useState<string[]>([])
  const [parsingId, setParsingId]     = useState<string | null>(null)
  const [parsedInfo, setParsedInfo]   = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  if (!canSeeResults(role)) return null

  // ─── Upload ────────────────────────────────────────────────────────────────

  async function handleFiles(files: File[]) {
    setGlobalError('')
    const pdfs = files.filter(isValidPdf)
    const invalid = files.length - pdfs.length

    if (invalid > 0) {
      setGlobalError(`${invalid} bestand${invalid > 1 ? 'en zijn' : ' is'} overgeslagen — alleen PDF toegestaan.`)
    }
    if (pdfs.length === 0) return

    const MAX_MB = 20
    const tooBig = pdfs.filter(f => f.size > MAX_MB * 1024 * 1024)
    if (tooBig.length > 0) {
      setGlobalError(`${tooBig.map(f => f.name).join(', ')} ${tooBig.length > 1 ? 'zijn' : 'is'} groter dan ${MAX_MB} MB.`)
      return
    }

    const supabase = createClient()
    const uploadedBy = name ?? email ?? 'Onbekend'

    // Start upload items (loading indicators)
    const items: UploadItem[] = pdfs.map(f => ({
      tempId: crypto.randomUUID(),
      filename: f.name,
      error: null,
    }))
    setUploading(prev => [...prev, ...items])

    for (let i = 0; i < pdfs.length; i++) {
      const file  = pdfs[i]
      const item  = items[i]
      const uid   = crypto.randomUUID()
      const path  = `${clientId}/${uid}-${file.name}`

      // Upload naar Supabase Storage
      const { error: storageErr } = await supabase.storage
        .from('client-documents')
        .upload(path, file)

      if (storageErr) {
        setUploading(prev => prev.map(u =>
          u.tempId === item.tempId ? { ...u, error: storageErr.message } : u
        ))
        continue
      }

      // Sla metadata op in de database
      const { data: doc, error: dbErr } = await supabase
        .from('vh_client_document')
        .insert({
          client_id:    clientId,
          filename:     file.name,
          storage_path: path,
          file_size:    file.size,
          uploaded_by:  uploadedBy,
        })
        .select('id, client_id, filename, storage_path, file_size, uploaded_by, created_at')
        .single()

      if (dbErr) {
        // Storage-bestand opruimen als db-insert mislukt
        await supabase.storage.from('client-documents').remove([path])
        setUploading(prev => prev.map(u =>
          u.tempId === item.tempId ? { ...u, error: dbErr.message } : u
        ))
        continue
      }

      setDocuments(prev => [doc as Document, ...prev])
      setUploading(prev => prev.filter(u => u.tempId !== item.tempId))
    }
  }

  // ─── Download via backend-proxy (rolcontrole + auditlogging) ────────────────

  function handleDownload(doc: Document) {
    // De route controleert rol, logt de download en streamt het bestand.
    // Geen signed URL meer in de browser.
    window.open(`/api/documenten/${doc.id}/download`, '_blank')
  }

  // ─── Verwijderen ───────────────────────────────────────────────────────────

  async function handleDelete(doc: Document) {
    const supabase = createClient()

    await supabase.storage.from('client-documents').remove([doc.storage_path])
    await supabase.from('vh_client_document').delete().eq('id', doc.id)

    setDocuments(prev => prev.filter(d => d.id !== doc.id))
    setConfirmDelete(null)
  }

  // ─── Beveiligd versturen naar de cliënt (via bezorg-provider + auditlog) ─────

  async function handleSendSecure(doc: Document) {
    setConfirmSend(null)
    setSendingId(doc.id)
    setGlobalError('')
    try {
      const res = await fetch('/api/reports/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentId: doc.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || 'Beveiligd versturen is mislukt.')
      } else {
        setSentIds(prev => [...prev, doc.id])
      }
    } catch {
      setGlobalError('Er ging iets mis bij het beveiligd versturen.')
    } finally {
      setSendingId(null)
    }
  }

  // ─── Rapport uitlezen → gestructureerde data (review-status) ─────────────────

  async function handleParse(doc: Document) {
    setParsingId(doc.id)
    setGlobalError('')
    try {
      const res = await fetch('/api/reports/parse', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ documentId: doc.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setGlobalError(data.error || 'Uitlezen is mislukt.')
      } else {
        const s = data.summary
        setParsedInfo(prev => ({
          ...prev,
          [doc.id]: `${s.biomarkers} markers · ${s.diseases} risico's · score ${s.resilienceScore ?? '?'} — controleer`,
        }))
      }
    } catch {
      setGlobalError('Er ging iets mis bij het uitlezen.')
    } finally {
      setParsingId(null)
    }
  }

  // ─── Drag & drop handlers ──────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent)  { e.preventDefault(); setDragging(true)  }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragging(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }

  const totalUploading = uploading.filter(u => !u.error).length

  return (
    <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#1e293b] flex items-center gap-2">
          <FileText size={15} className="text-[#94a3b8]" />
          Uitslagen
          {documents.length > 0 && (
            <span className="text-xs font-normal text-[#94a3b8]">({documents.length})</span>
          )}
        </h2>
        {totalUploading > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-[#64748b]">
            <Loader2 size={12} className="animate-spin" />
            {totalUploading} bezig met uploaden…
          </span>
        )}
      </div>

      {/* Body: twee kolommen */}
      <div className="flex min-h-[180px]">

        {/* ── Links: bestandenlijst ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Uploading items */}
          {uploading.length > 0 && (
            <div className="px-4 py-3 space-y-1.5 border-b border-[#f1f5f9]">
              {uploading.map(item => (
                <div key={item.tempId} className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                  item.error ? 'border-red-200 bg-red-50' : 'border-[#e2e8f0] bg-[#f8fafc]'
                }`}>
                  {item.error
                    ? <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    : <Loader2 size={13} className="animate-spin text-[#1f1683] shrink-0" />
                  }
                  <span className="text-sm text-[#1e293b] truncate flex-1">{item.filename}</span>
                  {item.error
                    ? <span className="text-xs text-red-500 truncate max-w-[160px]">{item.error}</span>
                    : <span className="text-xs text-[#94a3b8]">uploaden…</span>
                  }
                  {item.error && (
                    <button
                      onClick={() => setUploading(prev => prev.filter(u => u.tempId !== item.tempId))}
                      className="text-[#94a3b8] hover:text-[#64748b] text-xs"
                    >✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Documentenlijst */}
          {documents.length > 0 ? (
            <div className="overflow-y-auto divide-y divide-[#f1f5f9]">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafbfc] transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-[#fef2f2] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1e293b] truncate">{doc.filename}</p>
                    <p className="text-xs text-[#94a3b8]">
                      {doc.uploaded_by && <>{doc.uploaded_by} · </>}
                      {formatDateTime(doc.created_at)}
                      {doc.file_size != null && <> · {formatFileSize(doc.file_size)}</>}
                    </p>
                    {parsedInfo[doc.id] && (
                      <p className="text-xs text-emerald-600 mt-0.5">{parsedInfo[doc.id]}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {confirmDelete === doc.id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#64748b]">Verwijderen?</span>
                        <button onClick={() => handleDelete(doc)} className="font-semibold text-red-600 hover:text-red-700">Ja</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-[#64748b] hover:text-[#1e293b]">Nee</button>
                      </div>
                    ) : confirmSend === doc.id ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[#64748b]">Beveiligd naar cliënt versturen?</span>
                        <button onClick={() => handleSendSecure(doc)} className="font-semibold text-[#1f1683] hover:text-[#1a1270]">Ja</button>
                        <button onClick={() => setConfirmSend(null)} className="text-[#64748b] hover:text-[#1e293b]">Nee</button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => handleParse(doc)}
                          disabled={parsingId === doc.id}
                          title="Gegevens uitlezen uit het PDF"
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1f1683] hover:bg-[#eef4ff] transition-colors disabled:opacity-50"
                        >
                          {parsingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                        </button>
                        {sentIds.includes(doc.id) && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 mr-1">
                            <ShieldCheck size={13} /> Verstuurd
                          </span>
                        )}
                        <button
                          onClick={() => setConfirmSend(doc.id)}
                          disabled={sendingId === doc.id}
                          title="Beveiligd versturen naar cliënt"
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1f1683] hover:bg-[#eef4ff] transition-colors disabled:opacity-50"
                        >
                          {sendingId === doc.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <ShieldCheck size={14} />}
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          title="Openen"
                          className="p-1.5 rounded-lg text-[#64748b] hover:text-[#1f1683] hover:bg-[#eef4ff] transition-colors"
                        >
                          <ExternalLink size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(doc.id)}
                          title="Verwijderen"
                          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : uploading.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-6 py-8">
              <p className="text-sm text-[#94a3b8] text-center">
                Nog geen uitslagen geüpload voor deze cliënt.
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Rechts: drop zone ─────────────────────────────────────────────── */}
        <div className="w-72 shrink-0 border-l border-[#f1f5f9] p-4 flex flex-col gap-3">

          {/* Foutmelding */}
          {globalError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 flex-1">{globalError}</p>
              <button onClick={() => setGlobalError('')} className="text-red-400 hover:text-red-600 text-xs shrink-0">✕</button>
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex-1 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer select-none transition-all ${
              dragging
                ? 'border-[#1f1683] bg-[#eef4ff]'
                : 'border-[#e2e8f0] hover:border-[#1f1683]/50 hover:bg-[#fafbff]'
            }`}
          >
            <div className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
              dragging ? 'bg-[#dce9ff]' : 'bg-[#f0f4ff]'
            }`}>
              <FileText size={20} className={dragging ? 'text-[#1f1683]' : 'text-[#4f6ef7]'} />
            </div>
            <p className="text-sm font-medium text-[#1e293b] leading-snug">
              {dragging ? 'Loslaten om te uploaden' : 'Sleep PDF hierheen'}
            </p>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              of <span className="text-[#1f1683] font-medium">klik om te bladeren</span>
              <br />alleen PDF · max. 20 MB
            </p>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              className="hidden"
              onChange={e => {
                handleFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
