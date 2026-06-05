import type { Metadata } from 'next'
import { PortalHeader } from './PortalHeader'

export const metadata: Metadata = {
  title: 'Vita Health — Biomarker bloedtest aanvragen',
  description: 'Ontdek wat er in jouw bloed zit. Bestel een biomarker testkit en ontvang inzicht in jouw gezondheid.',
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <PortalHeader />

      {children}

      {/* Footer */}
      <footer className="border-t border-[#e2e8f0] mt-16">
        <div className="mx-auto max-w-4xl px-6 py-8 text-center text-sm text-[#94a3b8]">
          <p>© {new Date().getFullYear()} Vita Health · <a href="https://helpdesk.vita-health.nl" className="hover:text-[#64748b]">helpdesk.vita-health.nl</a></p>
        </div>
      </footer>
    </div>
  )
}
