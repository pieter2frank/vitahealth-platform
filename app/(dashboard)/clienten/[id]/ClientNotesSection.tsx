'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Plus, Pencil, X, Save, ClipboardList, Trash2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { useUser } from '@/components/providers/UserProvider'
import { canSeeResults } from '@/lib/auth/roles'
import { CollapsibleCard } from '@/components/ui/CollapsibleCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  notes: string
  actions: string
  created_by: string
  updated_by: string | null
  created_at: string
  updated_at: string
}

interface Props {
  clientId: string
  initialNotes: Note[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionLines({ text }: { text: string }) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length === 0) return <p className="text-sm text-[#94a3b8] italic">Geen acties.</p>
  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-[#1e293b]">
          <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-[#1f1683] shrink-0" />
          {line}
        </li>
      ))}
    </ul>
  )
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  onUpdated,
  onDeleted,
}: {
  note: Note
  onUpdated: (n: Note) => void
  onDeleted: (id: string) => void
}) {
  const { name, email } = useUser()
  const [editing, setEditing]         = useState(false)
  const [notesText, setNotesText]     = useState(note.notes)
  const [actionsText, setActionsText] = useState(note.actions)
  const [saving, setSaving]           = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError]             = useState('')

  const wasEdited = note.updated_by !== null

  async function handleSave() {
    setSaving(true)
    setError('')
    const supabase = createClient()
    const updatedBy = name ?? email ?? 'Onbekend'
    const now = new Date().toISOString()

    const { error: err } = await supabase
      .from('vh_client_note')
      .update({ notes: notesText, actions: actionsText, updated_by: updatedBy, updated_at: now })
      .eq('id', note.id)

    if (err) { setError(err.message); setSaving(false); return }
    onUpdated({ ...note, notes: notesText, actions: actionsText, updated_by: updatedBy, updated_at: now })
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const supabase = createClient()
    const { error: err } = await supabase.from('vh_client_note').delete().eq('id', note.id)
    if (err) { setError(err.message); setDeleting(false); setConfirmDelete(false); return }
    onDeleted(note.id)
  }

  function startEdit() {
    setNotesText(note.notes)
    setActionsText(note.actions)
    setError('')
    setEditing(true)
  }

  function cancelEdit() {
    setNotesText(note.notes)
    setActionsText(note.actions)
    setError('')
    setEditing(false)
  }

  return (
    <div className="border-b border-[#f1f5f9] last:border-b-0">

      {/* Kaart-header: auteur, datum, bewerkinfo */}
      <div className="flex items-start justify-between gap-3 px-5 py-3 bg-[#f8fafc]">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-semibold text-[#1e293b]">{note.created_by || '—'}</span>
            <span className="text-[#cbd5e1]">·</span>
            <span className="text-[#64748b]">{formatDateTime(note.created_at)}</span>
          </div>
          {wasEdited && (
            <p className="text-[10px] text-[#94a3b8]">
              Bewerkt door {note.updated_by} — {formatDateTime(note.updated_at)}
            </p>
          )}
        </div>

        {/* Acties rechtsboven */}
        <div className="flex items-center gap-2 shrink-0">
          {!editing && !confirmDelete && (
            <>
              <button
                onClick={startEdit}
                className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1f1683] transition-colors"
              >
                <Pencil size={11} />
                Bewerken
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1 text-xs text-[#94a3b8] hover:text-red-500 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
          {editing && (
            <button
              onClick={cancelEdit}
              className="inline-flex items-center gap-1 text-xs text-[#64748b] hover:text-[#1e293b]"
            >
              <X size={11} />
              Annuleren
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#64748b]">Verwijderen?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? 'Bezig…' : 'Ja'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-[#64748b] hover:text-[#1e293b]"
              >
                Nee
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bewerkformulier */}
      {editing && (
        <div className="p-5 space-y-4">
          {/* PII-beleid (kluis fase 5): vrije tekst wordt niet versleuteld */}
          <p className="mb-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-xs text-[#64748b]">
            Let op: notities worden niet versleuteld. Zet er geen herleidbare persoonsgegevens in
            (adres, geboortedatum, BSN e.d.) — die horen in de daarvoor bestemde velden.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1.5">Aantekeningen</label>
              <textarea
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                rows={6}
                placeholder="Aantekeningen…"
                className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y leading-relaxed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1.5">
                Acties
                <span className="ml-1 font-normal text-[#94a3b8]">(één actie per regel)</span>
              </label>
              <textarea
                value={actionsText}
                onChange={e => setActionsText(e.target.value)}
                rows={6}
                placeholder={"Actie 1\nActie 2\n…"}
                className="w-full rounded-xl border border-[#e2e8f0] px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y leading-relaxed"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </div>
      )}

      {/* Weergave */}
      {!editing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#f1f5f9]">
          <div className="px-5 py-4">
            {note.notes.trim() ? (
              <p className="text-sm text-[#1e293b] whitespace-pre-wrap leading-relaxed">{note.notes}</p>
            ) : (
              <p className="text-sm text-[#94a3b8] italic">Geen aantekeningen.</p>
            )}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-[#64748b] mb-2 flex items-center gap-1.5">
              <ClipboardList size={12} />
              Acties
            </p>
            <ActionLines text={note.actions} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Nieuw-notitieformulier ────────────────────────────────────────────────────

function NewNoteForm({
  clientId,
  createdBy,
  onCreated,
  onCancel,
}: {
  clientId: string
  createdBy: string
  onCreated: (note: Note) => void
  onCancel: () => void
}) {
  const [notesText, setNotesText]     = useState('')
  const [actionsText, setActionsText] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleSave() {
    if (!notesText.trim() && !actionsText.trim()) {
      setError('Vul minimaal een aantekening of een actie in.')
      return
    }
    setSaving(true)
    setError('')
    const supabase = createClient()

    const { data, error: err } = await supabase
      .from('vh_client_note')
      .insert({ client_id: clientId, notes: notesText, actions: actionsText, created_by: createdBy })
      .select('id, notes, actions, created_by, updated_by, created_at, updated_at')
      .single()

    if (err) { setError(err.message); setSaving(false); return }
    onCreated(data as Note)
  }

  return (
    <div className="border-b border-[#e2e8f0] bg-[#f8fafc] p-5 space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1.5">Aantekeningen</label>
          <textarea
            value={notesText}
            onChange={e => setNotesText(e.target.value)}
            rows={6}
            placeholder="Aantekeningen over dit consult of deze cliënt…"
            autoFocus
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y leading-relaxed"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1.5">
            Acties
            <span className="ml-1 font-normal text-[#94a3b8]">(één actie per regel)</span>
          </label>
          <textarea
            value={actionsText}
            onChange={e => setActionsText(e.target.value)}
            rows={6}
            placeholder={"Bloedwaarden controleren bij volgend consult\nVoedingsdagboek opsturen\n…"}
            className="w-full rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683] resize-y leading-relaxed"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="text-xs text-[#64748b] hover:text-[#1e293b] transition-colors"
        >
          Annuleren
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={14} />
          {saving ? 'Opslaan…' : 'Aantekening opslaan'}
        </button>
      </div>
    </div>
  )
}

// ─── Hoofdcomponent ───────────────────────────────────────────────────────────

export function ClientNotesSection({ clientId, initialNotes }: Props) {
  const { name, email, role } = useUser()
  const [notes, setNotes]             = useState<Note[]>(initialNotes)
  const [showNewForm, setShowNewForm] = useState(false)

  // Sectie uitsluitend zichtbaar voor arts en leefstijlarts
  if (!canSeeResults(role)) return null

  const createdBy = name ?? email ?? 'Onbekend'

  return (
    <CollapsibleCard
      className="mt-4"
      icon={<FileText size={15} className="shrink-0 text-[#94a3b8]" />}
      title={<>Aantekeningen arts {notes.length > 0 && <span className="text-xs font-normal text-[#94a3b8]">({notes.length})</span>}</>}
      actions={
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs text-[#1f1683] hover:underline"
        >
          {showNewForm
            ? <><X size={12} /> Sluiten</>
            : <><Plus size={12} /> Nieuwe aantekening</>}
        </button>
      }
    >
      {/* Nieuw-formulier */}
      {showNewForm && (
        <NewNoteForm
          clientId={clientId}
          createdBy={createdBy}
          onCreated={note => { setNotes(prev => [note, ...prev]); setShowNewForm(false) }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Lege staat */}
      {notes.length === 0 && !showNewForm && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[#94a3b8]">Nog geen aantekeningen voor deze cliënt.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-2 text-xs text-[#1f1683] hover:underline"
          >
            + Eerste aantekening toevoegen
          </button>
        </div>
      )}

      {/* Notities — nieuwste bovenaan */}
      {notes.length > 0 && (
        <div>
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onUpdated={updated => setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))}
              onDeleted={id => setNotes(prev => prev.filter(n => n.id !== id))}
            />
          ))}
        </div>
      )}
    </CollapsibleCard>
  )
}
