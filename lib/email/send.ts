import { Resend } from 'resend'

// Eén plek voor de Resend-client + de afzender, zodat routes niet elk hun eigen
// `new Resend(...)` en afzender-string herhalen. Server-only.

const resend = new Resend(process.env.RESEND_API_KEY)

export const DEFAULT_FROM = `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@helpdesk.vita-health.nl'}>`

export async function sendEmail(opts: {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
}): Promise<{ ok: boolean; error?: string }> {
  const { error } = await resend.emails.send({
    from:    opts.from ?? DEFAULT_FROM,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
  })
  if (error) {
    console.error('[email] Resend error:', error)
    return { ok: false, error: 'E-mail kon niet worden verzonden.' }
  }
  return { ok: true }
}
