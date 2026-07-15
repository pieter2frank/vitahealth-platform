'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  async function out() {
    await createClient().auth.signOut()
    // redirect=/ zodat een volgende login terugkeert naar de annotatie-wortel
    // (en niet naar /dashboard, dat op dit subdomein niet bestaat).
    router.push('/auth/login?redirect=/')
    router.refresh()
  }
  return (
    <button onClick={out} className="inline-flex items-center gap-1 text-[#64748b] hover:text-red-500 transition-colors">
      <LogOut size={14} /> Uitloggen
    </button>
  )
}
