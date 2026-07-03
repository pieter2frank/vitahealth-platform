import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { canManageKnowledge } from '@/lib/auth/roles'
import { KnowledgeForm } from '../KnowledgeForm'

export default async function NieuwKennisdocumentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('vh_medewerker').select('role').eq('user_id', user?.id ?? '').maybeSingle()
  if (!canManageKnowledge(me?.role)) redirect('/dashboard')

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/kennisbank" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar kennisbank
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Nieuw kennisdocument</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Na aanmaken kun je het document indexeren en op &lsquo;Actief&rsquo; zetten.
        </p>
      </div>
      <KnowledgeForm />
    </div>
  )
}
