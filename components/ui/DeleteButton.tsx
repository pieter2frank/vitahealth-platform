'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Trash2, AlertTriangle, X } from 'lucide-react'

interface Props {
  table: string
  id: string
  redirectTo: string
  /** Hoe noem je dit record? Bijv. "deze cliënt" */
  entityLabel: string
  /**
   * Als ingevuld: verwijdering is geblokkeerd met deze uitleg.
   * Laat leeg als verwijdering gewoon mag (alleen bevestiging).
   */
  blockedMessage?: string
}

export function DeleteButton({ table, id, redirectTo, entityLabel, blockedMessage }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setDeleting(true)
    setError('')
    const supabase = createClient()
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) {
      setError(err.message)
      setDeleting(false)
      return
    }
    router.push(redirectTo)
  }

  const blocked = !!blockedMessage

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        Verwijderen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl mx-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  blocked ? 'bg-orange-100' : 'bg-red-100'
                }`}>
                  <AlertTriangle size={18} className={blocked ? 'text-orange-500' : 'text-red-500'} />
                </div>
                <h2 className="text-base font-semibold text-[#1e293b]">
                  {blocked ? 'Verwijderen niet mogelijk' : `Verwijder ${entityLabel}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#94a3b8] hover:text-[#64748b] transition-colors ml-4 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {blocked ? (
              <>
                <p className="text-sm text-[#64748b] leading-relaxed mb-5">{blockedMessage}</p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    Sluiten
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-[#64748b] leading-relaxed mb-5">
                  Weet je zeker dat je <strong>{entityLabel}</strong> wilt verwijderen?
                  Deze actie kan niet ongedaan worden gemaakt.
                </p>
                {error && (
                  <p className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-2 text-sm font-medium text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Verwijderen…' : 'Ja, verwijderen'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
