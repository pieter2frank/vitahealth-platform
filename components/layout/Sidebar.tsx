'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, TestTube2, Users, Building2, Stethoscope,
  Package, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard',   label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/testkits',    label: 'Testkits',      icon: TestTube2 },
  { href: '/clienten',    label: 'Cliënten',      icon: Users },
  { href: '/bedrijven',   label: 'Bedrijven',     icon: Building2 },
  { href: '/arbodiensten',label: 'Arbodiensten',  icon: Stethoscope },
  { href: '/batches',     label: 'Batches NHG',   icon: Package },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#e2e8f0] bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#e2e8f0] px-5">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#1f1683] flex items-center justify-center">
            <TestTube2 size={16} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[#1f1683]">Vita Health</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[#eef4ff] text-[#1f1683]'
                  : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]'
              )}
            >
              <Icon size={17} className={active ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-[#e2e8f0] p-3">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600 transition-colors"
        >
          <LogOut size={17} />
          Uitloggen
        </button>
      </div>
    </aside>
  )
}
