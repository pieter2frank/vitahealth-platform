'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { X, UserPlus, ClipboardCheck } from 'lucide-react'

interface Toast {
  id: string
  clientId: string
  name: string
  message: string
  type: 'aanmelding' | 'intake'
}

const AUTO_DISMISS_MS = 10_000

export function RealtimeNotifications() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-4), { ...toast, id }]) // max 5 tegelijk
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  useEffect(() => {
    const supabase = createClient()

    // PII-kluis: het realtime-event bevat geen naam meer (vh_client is pseudoniem).
    // Naam via de server route uit de kluis halen; korte retry omdat het event een
    // fractie eerder kan aankomen dan de kluisrij bij een verse registratie.
    async function nameFor(clientId: string): Promise<string> {
      for (const delay of [0, 1500]) {
        if (delay) await new Promise(r => setTimeout(r, delay))
        try {
          const j = await (await fetch(`/api/clients/search?id=${clientId}`)).json()
          const name = (j.results?.[0]?.name as string | undefined)?.trim()
          if (name) return name
        } catch { /* volgende poging */ }
      }
      return 'Nieuwe cliënt'
    }

    const channel = supabase
      .channel('dashboard-intake-meldingen')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'vh_client' },
        async (payload) => {
          const c = payload.new as { id: string }
          addToast({
            clientId: c.id,
            name:     await nameFor(c.id),
            message:  'heeft zich aangemeld via het portaal',
            type:     'aanmelding',
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vh_client' },
        async (payload) => {
          const c = payload.new as { id: string; enrollment_status: string }
          if (c.enrollment_status === 'vragenlijst_ingevuld') {
            addToast({
              clientId: c.id,
              name:     await nameFor(c.id),
              message:  'heeft de intake volledig ingevuld',
              type:     'intake',
            })
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [addToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2 items-end pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.type === 'intake' ? ClipboardCheck : UserPlus
  const iconColor = toast.type === 'intake' ? 'text-violet-600 bg-violet-50' : 'text-[#1f1683] bg-[#eef4ff]'
  const borderColor = toast.type === 'intake' ? 'border-violet-200' : 'border-[#c7d9ff]'

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${borderColor} bg-white px-4 py-3 shadow-lg w-80 animate-in slide-in-from-right-4 fade-in duration-200`}
    >
      <div className={`rounded-lg p-1.5 shrink-0 mt-0.5 ${iconColor}`}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1e293b] truncate">{toast.name}</p>
        <p className="text-xs text-[#64748b] mt-0.5">{toast.message}</p>
        <Link
          href={`/clienten/${toast.clientId}`}
          className="mt-1.5 inline-block text-xs font-medium text-[#1f1683] hover:underline"
        >
          Bekijk cliënt →
        </Link>
      </div>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-[#94a3b8] hover:text-[#64748b] hover:bg-[#f1f5f9] transition-colors mt-0.5"
      >
        <X size={14} />
      </button>
    </div>
  )
}
