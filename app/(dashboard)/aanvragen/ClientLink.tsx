'use client'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export function ClientLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      onClick={e => e.stopPropagation()}
      className="text-xs text-[#1f1683] hover:underline flex items-center gap-1"
    >
      <UserPlus size={12} />
      Gekoppeld
    </Link>
  )
}
