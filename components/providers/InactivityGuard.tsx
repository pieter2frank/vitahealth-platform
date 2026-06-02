'use client'
import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TIMEOUT_MS = 5 * 60 * 1000 // 5 minuten

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'scroll', 'touchstart', 'click',
] as const

export function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login?reden=inactiviteit')
  }, [router])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>

    function reset() {
      clearTimeout(timer)
      timer = setTimeout(logout, TIMEOUT_MS)
    }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset() // Start timer direct bij laden

    return () => {
      clearTimeout(timer)
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, reset))
    }
  }, [logout])

  return <>{children}</>
}
