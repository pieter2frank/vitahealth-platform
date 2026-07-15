import Link from 'next/link'
import Image from 'next/image'
import { getCurrentUser } from '@/lib/auth/guard'
import { LogoutButton } from './LogoutButton'

// Shell voor het annotatie-subdomein. Geen guard hier (anders loopt /geen-toegang
// in een redirect-lus); elke pagina dwingt zelf de juiste rol af.
export default async function AnnotatieLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="min-h-screen bg-[#f6f7fb]">
      <header className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="Vita Health" width={130} height={40} priority />
            <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-xs font-semibold text-[#1f1683]">Annotatie</span>
          </Link>
          {user && (
            <nav className="flex items-center gap-4 text-sm">
              {!isAdmin && <Link href="/" className="text-[#64748b] hover:text-[#1f1683]">Casussen</Link>}
              {isAdmin && <Link href="/admin" className="text-[#64748b] hover:text-[#1f1683]">Rondes</Link>}
              <span className="text-[#94a3b8]">{user.name}</span>
              <LogoutButton />
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
    </div>
  )
}
