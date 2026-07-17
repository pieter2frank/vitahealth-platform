'use client'
import { Fragment } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, TestTube2, Users, Building2, Stethoscope,
  Package, LogOut, CircleUserRound, ClipboardList, ScrollText, Dumbbell, Settings, ShieldCheck, UserCog, FileCheck, BookOpen, FlaskConical, Sparkles,
} from 'lucide-react'
import { isAdmin, canManageKnowledge, canSeeResults } from '@/lib/auth/roles'
import { APP_VERSION } from '@/lib/version'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/components/providers/UserProvider'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  badgeKey: 'newOrders' | null
}

const NAV_GROUPS: NavItem[][] = [
  [
    { href: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, badgeKey: null },
    { href: '/testkits',     label: 'Testkits',      icon: TestTube2,       badgeKey: null },
    { href: '/aanvragen',    label: 'Aanvragen',     icon: ClipboardList,   badgeKey: 'newOrders' },
    { href: '/clienten',     label: 'Cliënten',      icon: Users,           badgeKey: null },
    { href: '/bedrijven',    label: 'Bedrijven',     icon: Building2,       badgeKey: null },
    { href: '/arbodiensten', label: 'Arbodiensten',  icon: Stethoscope,     badgeKey: null },
    { href: '/batches',      label: 'Batches NH',    icon: Package,         badgeKey: null },
  ],
  [
    { href: '/vragenlijsten',  label: 'Vragenlijsten',  icon: ScrollText, badgeKey: null },
    { href: '/programmas',     label: "Programma's",    icon: Dumbbell,   badgeKey: null },
    { href: '/instellingen',   label: 'Instellingen',   icon: Settings,   badgeKey: null },
  ],
]

const ROLE_LABELS: Record<string, string> = {
  admin:         'Admin',
  arts:          'Arts',
  leefstijlarts: 'Leefstijlarts',
}

const ROLE_COLORS: Record<string, string> = {
  admin:         'bg-slate-100 text-slate-600 border-slate-200',
  arts:          'bg-[#eef4ff] text-[#1f1683] border-[#c7d7fd]',
  leefstijlarts: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

interface SidebarProps {
  newOrderCount?: number
}

export function Sidebar({ newOrderCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { email, name, role } = useUser()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#e2e8f0] bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#e2e8f0] px-5">
        <Link href="/dashboard">
          <Image src="/logo.svg" alt="Vita Health" width={130} height={40} priority />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, gi) => (
          <Fragment key={gi}>
            {gi > 0 && (
              <div className="my-2.5 border-t border-[#e2e8f0]" />
            )}
            <div className="space-y-0.5">
              {group.map(({ href, label, icon: Icon, badgeKey }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                const badge = badgeKey === 'newOrders' ? newOrderCount : 0
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
                    <span className="flex-1">{label}</span>
                    {badge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </Fragment>
        ))}

        {/* Uitslagen inladen — arts/leefstijlarts (centraal, op kitnummer) */}
        {canSeeResults(role) && (
          <>
            <div className="my-2.5 border-t border-[#e2e8f0]" />
            <Link
              href="/uitslagen"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/uitslagen' || pathname.startsWith('/uitslagen/')
                  ? 'bg-[#eef4ff] text-[#1f1683]'
                  : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]'
              )}
            >
              <FlaskConical size={17} className={pathname.startsWith('/uitslagen') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
              <span className="flex-1">Uitslagen inladen</span>
            </Link>
          </>
        )}

        {/* Kennisbank — arts/leefstijlarts + admin (voedt het AI-advies) */}
        {canManageKnowledge(role) && (
          <>
            <div className="my-2.5 border-t border-[#e2e8f0]" />
            <Link
              href="/kennisbank"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/kennisbank' || pathname.startsWith('/kennisbank/')
                  ? 'bg-[#eef4ff] text-[#1f1683]'
                  : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]'
              )}
            >
              <BookOpen size={17} className={pathname.startsWith('/kennisbank') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
              <span className="flex-1">Kennisbank</span>
            </Link>
            <Link
              href="/ai-eval"
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === '/ai-eval' || pathname.startsWith('/ai-eval/')
                  ? 'bg-[#eef4ff] text-[#1f1683]'
                  : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#1e293b]'
              )}
            >
              <Sparkles size={17} className={pathname.startsWith('/ai-eval') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
              <span className="flex-1">AI-eval</span>
            </Link>
          </>
        )}
      </nav>

      {/* Admin: medewerkers + auditlog onderaan nav */}
      {isAdmin(role) && (
        <div className="px-3 pt-2 pb-1 border-t border-[#f1f5f9] mt-1 space-y-0.5">
          <Link
            href="/medewerkers"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/medewerkers')
                ? 'bg-[#eef4ff] text-[#1f1683]'
                : 'text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#1e293b]'
            )}
          >
            <UserCog size={17} className={pathname.startsWith('/medewerkers') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
            <span className="flex-1">Medewerkers</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8] border border-[#e2e8f0] rounded px-1">Admin</span>
          </Link>
          <Link
            href="/toestemmingen"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/toestemmingen')
                ? 'bg-[#eef4ff] text-[#1f1683]'
                : 'text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#1e293b]'
            )}
          >
            <FileCheck size={17} className={pathname.startsWith('/toestemmingen') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
            <span className="flex-1">Toestemmingen</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8] border border-[#e2e8f0] rounded px-1">Admin</span>
          </Link>
          <Link
            href="/auditlog"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith('/auditlog')
                ? 'bg-[#eef4ff] text-[#1f1683]'
                : 'text-[#94a3b8] hover:bg-[#f8fafc] hover:text-[#1e293b]'
            )}
          >
            <ShieldCheck size={17} className={pathname.startsWith('/auditlog') ? 'text-[#1f1683]' : 'text-[#94a3b8]'} />
            <span className="flex-1">Auditlog</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide text-[#94a3b8] border border-[#e2e8f0] rounded px-1">Admin</span>
          </Link>
        </div>
      )}

      {/* Ingelogde gebruiker + uitloggen */}
      <div className="border-t border-[#e2e8f0] p-3 space-y-1">
        {(name || email) && (
          <div className="px-3 py-2.5 rounded-lg bg-[#f8fafc]">
            <div className="flex items-center gap-2 mb-1">
              <CircleUserRound size={15} className="text-[#94a3b8] shrink-0" />
              <span className="text-sm font-medium text-[#1e293b] truncate leading-tight">
                {name ?? email}
              </span>
            </div>
            {canSeeResults(role) && (
              <p className="mb-1.5 pl-[23px] text-[11px] font-semibold text-[#1f1683] leading-none">Medisch Team</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {role && (
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {ROLE_LABELS[role] ?? role}
                </span>
              )}
              {name && email && (
                <span className="text-[10px] text-[#94a3b8] truncate">{email}</span>
              )}
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#64748b] hover:bg-[#fff1f1] hover:text-red-600 transition-colors"
        >
          <LogOut size={17} />
          Uitloggen
        </button>
        <p className="px-3 pt-1 text-[10px] text-[#cbd5e1] text-center">Vita Health Platform v{APP_VERSION}</p>
      </div>
    </aside>
  )
}
