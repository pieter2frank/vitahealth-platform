'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export function LogoutButton() {
  const router = useRouter()
  async function out() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }
  return (
    <button onClick={out} className="inline-flex items-center gap-1 text-[#64748b] hover:text-red-500 transition-colors">
      <LogOut size={14} /> Uitloggen
    </button>
  )
}
