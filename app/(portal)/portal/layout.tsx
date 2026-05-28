import type { Metadata } from 'next'
import Image from 'next/image'

export const metadata: Metadata = {
  title: 'Vita Health — Biomarker bloedtest aanvragen',
  description: 'Ontdek wat er in jouw bloed zit. Bestel een biomarker testkit en ontvang inzicht in jouw gezondheid.',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-[#e2e8f0] bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <a href="/portal">
            <Image src="/logo.svg" alt="Vita Health" width={140} height={43} priority />
          </a>
          <a
            href="/portal/aanvragen"
            className="rounded-lg bg-[#1f1683] px-4 py-2 text-sm font-medium text-white hover:bg-[#1a1270] transition-colors"
          >
            Aanmelden
          </a>
        </div>
      </header>

      {children}

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] mt-16">
        <div className="mx-auto max-w-4xl px-6 py-8 text-center text-sm text-[#94a3b8]">
          <p>© {new Date().getFullYear()} Vita Health · <a href="mailto:info@vita-health.nl" className="hover:text-[#64748b]">info@vita-health.nl</a></p>
        </div>
      </footer>
    </div>
  )
}
