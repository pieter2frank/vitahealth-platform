// Authenticatie voor cron-endpoints.
// Accepteert het geheim via twee headers, zodat verschillende schedulers werken:
//   - x-cron-secret: <CRON_SECRET>
//   - Authorization: Bearer <CRON_SECRET>
export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const provided =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null
  return provided === secret
}
