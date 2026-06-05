'use client'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function PortalHeader() {
  const pathname = usePathname()

  // Knop verbergen tijdens de aanmeldprocedure en op de statuspagina —
  // daar is hij niet nodig en werkt verwarrend.
  const hideButton =
    pathname.startsWith('/portal/aanmelden') ||
    pathname.startsWith('/portal/aanvragen') ||
    pathname.startsWith('/portal/status')

  return (
    <header className="border-b border-[#e2e8f0] bg-white">
      <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
        <a href="/portal">
          <Image src="/logo.svg" alt="Vita Health" width={140} height={43} priority />
        </a>
        {!hideButton && (
          <a
            href="/portal/aanvragen"
            className="rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            Aanmelden
          </a>
        )}
      </div>
    </header>
  )
}
