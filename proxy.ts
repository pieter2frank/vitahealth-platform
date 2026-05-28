import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PORTAL_HOSTNAMES = [
  'ikwilgraageentest.vita-health.nl',
  'www.ikwilgraageentest.vita-health.nl',
]

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? ''

  // Portaal domein → herschrijf naar /portal/*
  if (PORTAL_HOSTNAMES.includes(host)) {
    const url = request.nextUrl.clone()
    const path = url.pathname === '/' ? '' : url.pathname
    url.pathname = `/portal${path}`
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
