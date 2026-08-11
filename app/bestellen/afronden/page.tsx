import { Suspense } from 'react'
import { AfrondenClient } from './AfrondenClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Betaling — Vita Health' }

export default function AfrondenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f8fafc] to-[#eef4ff] px-4 py-10">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-48" />}>
          <AfrondenClient />
        </Suspense>
      </div>
    </main>
  )
}
