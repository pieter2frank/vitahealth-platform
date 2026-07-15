import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PORTAL_HOSTNAMES = [
  'ikwilgraageentest.vita-health.nl',
  'www.ikwilgraageentest.vita-health.nl',
]

export function proxy(request: NextRequest) {
  const host = (request.headers.get('host') ?? '').toLowerCase()
  const { pathname } = request.nextUrl

  // Portaal domein → herschrijf naar /portal/*
  if (PORTAL_HOSTNAMES.includes(host)) {
    const url = request.nextUrl.clone()
    const path = pathname === '/' ? '' : pathname
    url.pathname = `/portal${path}`
    return NextResponse.rewrite(url)
  }

  // Annotatie-subdomein → herschrijf de wortel naar de /annotatie-tak.
  // Gedeelde auth/framework-paden passeren ongewijzigd.
  if (host.startsWith('annotatie.')) {
    // Vangnet: platform-only paden (bv. login-default /dashboard) → annotatie-wortel.
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
    const passthrough =
      pathname.startsWith('/_next') ||
      pathname.startsWith('/auth') ||
      pathname === '/favicon.ico' ||
      pathname === '/logo.svg' ||
      pathname.startsWith('/annotatie')
    if (!passthrough) {
      const url = request.nextUrl.clone()
      url.pathname = `/annotatie${pathname === '/' ? '' : pathname}`
      return NextResponse.rewrite(url)
    }
    return NextResponse.next()
  }

  // Platformhost (of overig): de /annotatie-tak is alleen via het subdomein bereikbaar.
  if (pathname.startsWith('/annotatie')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
