'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Save, RefreshCw, Trash2, CheckCircle2, Sparkles, Upload, Loader2 } from 'lucide-react'
import { KNOWLEDGE_DOMAINS } from '@/lib/knowledge-domains'

export interface KnowledgeExisting {
  id: string
  domain: string
  title: string
  body: string | null
  content_type: string
  media_url: string | null
  source: string | null
  evidence: string | null
  status: string
  chunkCount: number
}

const inputCls =
  'w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]'

export function KnowledgeForm({ existing }: { existing?: KnowledgeExisting }) {
  const router = useRouter()
  const isEdit = Boolean(existing)

  const [domain, setDomain]           = useState(existing?.domain ?? 'algemeen')
  const [title, setTitle]             = useState(existing?.title ?? '')
  const [contentType, setContentType] = useState(existing?.content_type ?? 'text')
  const [body, setBody]               = useState(existing?.body ?? '')
  const [mediaUrl, setMediaUrl]       = useState(existing?.media_url ?? '')
  const [source, setSource]           = useState(existing?.source ?? '')
  const [evidence, setEvidence]       = useState(existing?.evidence ?? '')
  const [status, setStatus]           = useState(existing?.status ?? 'draft')

  const [saving, setSaving]     = useState(false)
  const [indexing, setIndexing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]       = useState('')
  const [notice, setNotice]     = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = '' // zelfde bestand opnieuw kunnen kiezen
    if (!file) return
    setError(''); setNotice(''); setUploading(true)

    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/knowledge/extract', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    setUploading(false)
    if (!res.ok) { setError(data.error ?? 'Inlezen mislukt.'); return }

    // Tekst in het inhoudsveld zetten (toevoegen als er al inhoud staat).
    setBody(prev => prev.trim() ? `${prev.trim()}\n\n${data.text}` : data.text)
    // Titel afleiden uit bestandsnaam als die nog leeg is.
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''))
    if (!source.trim()) setSource(file.name)
    setContentType('text')
    setNotice(`Ingelezen: ${data.chars.toLocaleString('nl-NL')} tekens uit ${file.name}. Controleer de tekst en klik daarna op “Opslaan & (her)indexeren”.`)
  }

  const payload = () => ({
    domain, title, content_type: contentType, body,
    media_url: mediaUrl, source, evidence,
    ...(isEdit ? { status } : {}),
  })

  async function handleSave() {
    setError(''); setNotice('')
    if (!title.trim()) { setError('Titel is verplicht.'); return }
    setSaving(true)
    const res = await fetch(isEdit ? `/api/knowledge/${existing!.id}` : '/api/knowledge', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload()),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Opslaan mislukt.'); return }
    if (isEdit) { setNotice('Opgeslagen.'); router.refresh() }
    else router.push(`/kennisbank/${data.id}`)
  }

  async function handleIndex() {
    if (!existing) return
    setError(''); setNotice(''); setIndexing(true)
    // Eerst opslaan zodat de laatste tekst geïndexeerd wordt.
    const saveRes = await fetch(`/api/knowledge/${existing.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload()),
    })
    if (!saveRes.ok) {
      const d = await saveRes.json().catch(() => ({})); setIndexing(false)
      setError(d.error ?? 'Opslaan vóór indexeren mislukt.'); return
    }
    const res = await fetch('/api/knowledge/index', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ knowledgeId: existing.id }),
    })
    const data = await res.json().catch(() => ({}))
    setIndexing(false)
    if (!res.ok) { setError(data.error ?? 'Indexeren mislukt.'); return }
    setNotice(`Geïndexeerd: ${data.chunks} fragment${data.chunks === 1 ? '' : 'en'}.`)
    router.refresh()
  }

  async function handleDelete() {
    if (!existing) return
    setDeleting(true)
    const res = await fetch(`/api/knowledge/${existing.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({})); setDeleting(false); setConfirmDelete(false)
      setError(d.error ?? 'Verwijderen mislukt.'); return
    }
    router.push('/kennisbank')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#e2e8f0] bg-white p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">Domein</label>
            <select value={domain} onChange={e => setDomain(e.target.value)} className={inputCls}>
              {KNOWLEDGE_DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">Type</label>
            <select value={contentType} onChange={e => setContentType(e.target.value)} className={inputCls}>
              <option value="text">Tekst / artikel</option>
              <option value="video">Video (transcript)</option>
            </select>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#1e293b]">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className={inputCls}>
                <option value="draft">Concept</option>
                <option value="active">Actief (wordt gebruikt voor advies)</option>
                <option value="archived">Gearchiveerd</option>
              </select>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-[#1e293b]">Titel</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls}
            placeholder="Bijv. Vezels en darmgezondheid" />
        </div>

        {contentType === 'video' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">Video-URL</label>
            <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} className={inputCls}
              placeholder="https://…" />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-[#1e293b]">
              {contentType === 'video' ? 'Transcript / samenvatting' : 'Inhoud'}
              <span className="ml-1 font-normal text-[#94a3b8]">— wordt in fragmenten geïndexeerd</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? 'Inlezen…' : 'Bestand inlezen'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown,.rtf"
              onChange={handleFile}
              className="hidden"
            />
          </div>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={14}
            className={`${inputCls} resize-y leading-relaxed`}
            placeholder="Schrijf hier de kennis, of lees een bestand in (pdf, docx, txt, md, rtf). Scheid onderwerpen met een lege regel — dat helpt bij het opdelen in fragmenten." />
          <p className="text-xs text-[#94a3b8]">
            Uit een geüpload document wordt alleen de tekst overgenomen; controleer en corrigeer die vóór je indexeert.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">Bron <span className="font-normal text-[#94a3b8]">(optioneel)</span></label>
            <input value={source} onChange={e => setSource(e.target.value)} className={inputCls}
              placeholder="Bijv. Gezondheidsraad 2023" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#1e293b]">Bewijsniveau <span className="font-normal text-[#94a3b8]">(optioneel)</span></label>
            <input value={evidence} onChange={e => setEvidence(e.target.value)} className={inputCls}
              placeholder="Bijv. RCT / meta-analyse / richtlijn" />
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-sm text-emerald-700">{notice}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} loading={saving}>
          <Save size={15} /> {isEdit ? 'Wijzigingen opslaan' : 'Aanmaken'}
        </Button>

        {isEdit && (
          <>
            <Button onClick={handleIndex} loading={indexing} variant="outline">
              <RefreshCw size={15} /> Opslaan &amp; (her)indexeren
            </Button>
            <span className="inline-flex items-center gap-1.5 text-xs text-[#64748b]">
              <Sparkles size={13} className="text-[#94a3b8]" />
              {existing!.chunkCount > 0
                ? `${existing!.chunkCount} fragment${existing!.chunkCount === 1 ? '' : 'en'} geïndexeerd`
                : 'Nog niet geïndexeerd'}
            </span>

            <div className="ml-auto">
              {confirmDelete ? (
                <span className="inline-flex items-center gap-2 text-sm">
                  <span className="text-[#64748b]">Verwijderen?</span>
                  <button onClick={handleDelete} disabled={deleting}
                    className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50">
                    {deleting ? 'Bezig…' : 'Ja'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-[#64748b] hover:text-[#1e293b]">Nee</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-red-500 transition-colors">
                  <Trash2 size={14} /> Verwijderen
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {isEdit && status !== 'active' && (
        <p className="text-xs text-[#94a3b8]">
          Let op: alleen documenten met status <span className="font-medium">Actief</span> worden meegenomen bij het genereren van advies.
        </p>
      )}
    </div>
  )
}
