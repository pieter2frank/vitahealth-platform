import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ImportProgramForm } from './ImportProgramForm'

export default function ImporteerProgrammaPage() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/programmas" className="inline-flex items-center gap-1.5 text-sm text-[#64748b] hover:text-[#1e293b] mb-4">
          <ArrowLeft size={14} />
          Terug naar programma&apos;s
        </Link>
        <h1 className="text-2xl font-bold text-[#1e293b]">Programma importeren</h1>
        <p className="text-sm text-[#64748b] mt-0.5">
          Plak de JSON-definitie van een programma hieronder.
        </p>
      </div>
      <ImportProgramForm />
    </div>
  )
}
