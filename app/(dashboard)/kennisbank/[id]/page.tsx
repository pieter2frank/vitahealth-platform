import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { canManageKnowledge } from '@/lib/auth/roles'
import { KnowledgeForm } from '../KnowledgeForm'

export default async function KennisdocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('vh_medewerker').select('role').eq('user_id', user?.id ?? '').maybeSingle()
  if (!canManageKnowledge(me?.role)) redirect('/dashboard')

  const { data: doc } = await supabase
    .from('vh_knowledge')
    .select('id, domain, title, body, content_type, media_url, source, evidence, status')
    .eq('id', id).maybeSingle()
  if (!doc) notFound()

  const { count } = await supabase
    .from('vh_knowledge_chunk')
    .select('*', { count: 'exact', head: true })
    .eq('knowledge_id', id)

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/kennisbank" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar kennisbank
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">{doc.title}</h1>
        <p className="text-sm text-[#64748b] mt-0.5">Kennisdocument bewerken</p>
      </div>
      <KnowledgeForm existing={{ ...doc, chunkCount: count ?? 0 }} />
    </div>
  )
}
