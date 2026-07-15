import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // Deel de sessie tussen platform.* en annotatie.* door de cookie op het
  // hoofddomein te zetten (bijv. .vita-health.nl). Niet gezet in dev → host-only.
  const cookieDomain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(cookieDomain ? { cookieOptions: { domain: cookieDomain } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // called from Server Component — ignored
          }
        },
      },
    }
  )
}
