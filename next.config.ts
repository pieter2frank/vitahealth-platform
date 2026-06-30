import type { NextConfig } from "next";

// Supabase-host uit de publieke URL halen voor de CSP (connect-src).
const SUPABASE_HOST = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host }
  catch { return '' }
})();

// Content Security Policy. 'unsafe-inline' voor scripts/styles is nodig voor
// Next.js' inline bootstrap; te verstrengen met nonces in een latere iteratie.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // pdfjs-dist niet bundelen — wordt server-side uit node_modules geladen (rapport-parser).
  serverExternalPackages: ['pdfjs-dist'],
  // TypeScript checking kost te veel RAM op de build-server (2GB).
  // Types worden lokaal gecontroleerd voor elke push.
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
