'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/date-input'
import { UserPlus, AlertTriangle } from 'lucide-react'

interface Props {
  programId: string
  clients: { id: string; name: string }[]
}

export function AssignProgramForm({ programId, clients }: Props) {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) { setError('Selecteer een cliënt.'); return }

    setSaving(true)
    setError('')
    setSuccess('')
    const supabase = createClient()

    const { error: dbErr } = await supabase
      .from('vh_program_assignment')
      .insert({
        program_id: programId,
        client_id: clientId,
        start_date: startDate || null,
        status: 'active',
      })

    if (dbErr) {
      setError(dbErr.message)
      setSaving(false)
      return
    }

    const name = clients.find(c => c.id === clientId)?.name ?? 'Cliënt'
    setSuccess(`Programma toegewezen aan ${name}.`)
    setClientId('')
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-[#1e293b] mb-3 flex items-center gap-2">
        <UserPlus size={14} className="text-[#94a3b8]" />
        Toewijzen aan cliënt
      </h2>
      <form onSubmit={handleAssign} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#64748b] mb-1">Cliënt</label>
          <select
            value={clientId}
            onChange={e => { setClientId(e.target.value); setError(''); setSuccess('') }}
            className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-[#1f1683]/30 focus:border-[#1f1683]"
          >
            <option value="">— Selecteer een cliënt —</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <DateInput label="Startdatum" value={startDate} onChange={setStartDate} />
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
        {success && (
          <p className="text-xs text-green-600">{success}</p>
        )}

        <Button type="submit" loading={saving} size="sm" className="w-full">
          Toewijzen
        </Button>
      </form>
    </div>
  )
}
