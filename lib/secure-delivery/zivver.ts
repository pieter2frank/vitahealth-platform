import nodemailer from 'nodemailer'
import type { SecureDeliveryProvider, SecureReportInput, SecureDeliveryResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Zivver — beveiligde verzending via de Zivver SMTP-gateway.
//
// Zivver ontvangt de mail via SMTP (smtp.zivver.com:587, STARTTLS) met een door
// een Zivver-beheerder gegenereerde gebruikersnaam + wachtwoord, versleutelt het
// bericht en levert het beveiligd af. Zie:
// https://docs.zivver.com/nl/admin/smtp/connect-to-zivver-smtp-gateway.html
//
// Vereist aan de Zivver-kant:
//   • SMTP-credentials (gebruikersnaam/wachtwoord) uit het adminportaal;
//   • een ACTIEF Zivver-account voor het From-adres (ZIVVER_FROM);
//   • Zivver-DNS (SPF/DKIM) voor je domein.
//
// Env-variabelen:
//   ZIVVER_SMTP_HOST   (default smtp.zivver.com)
//   ZIVVER_SMTP_PORT   (default 587)
//   ZIVVER_SMTP_USER   (gebruikersnaam van de gateway)
//   ZIVVER_SMTP_PASS   (wachtwoord van de gateway)
//   ZIVVER_FROM        (afzender, moet een actief Zivver-account zijn)
//
// Per-bericht beveiliging via Zivver-headers (zie encryption-gateway.html):
//   • zivver-access-right: <ontvanger> sms <+31...>   → SMS-verificatie 2e factor
//   • zivver-minimum-recipient-verification: verification-email → min. e-mailverificatie
// We zetten SMS-verificatie als er een (internationaal genormaliseerd) mobiel
// nummer bekend is; anders geldt je organisatie-standaard in Zivver.
//
// ⚠️  Zivver vereist dat je verzendende domein/IP éérst via een supportticket op
//     de allowlist staat vóór er verbinding gemaakt kan worden (anders time-out).
// ─────────────────────────────────────────────────────────────────────────────

const HOST = process.env.ZIVVER_SMTP_HOST ?? 'smtp.zivver.com'
const PORT = Number(process.env.ZIVVER_SMTP_PORT ?? 587)
const USER = process.env.ZIVVER_SMTP_USER ?? ''
const PASS = process.env.ZIVVER_SMTP_PASS ?? ''
const FROM = process.env.ZIVVER_FROM ?? ''

// Zet een NL/vrij formaat mobiel nummer om naar internationaal (+31...) zoals
// Zivver in de zivver-access-right header verwacht. Retourneert null als het
// geen bruikbaar nummer is (dan geen SMS-header → org-standaard geldt).
function toIntlPhone(raw?: string | null): string | null {
  if (!raw) return null
  const p = raw.replace(/[\s\-().]/g, '')
  if (/^\+\d{8,15}$/.test(p)) return p
  if (/^00\d{8,15}$/.test(p)) return '+' + p.slice(2)
  if (/^0\d{8,12}$/.test(p)) return '+31' + p.slice(1)   // NL-default
  return null
}

export const zivverProvider: SecureDeliveryProvider = {
  name: 'zivver',

  isConfigured() {
    return Boolean(USER && PASS && FROM)
  },

  async sendReport(input: SecureReportInput): Promise<SecureDeliveryResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Zivver niet geconfigureerd (ZIVVER_SMTP_USER / ZIVVER_SMTP_PASS / ZIVVER_FROM ontbreken).' }
    }

    const transporter = nodemailer.createTransport({
      host:       HOST,
      port:       PORT,
      secure:     PORT === 465,   // 587/25 → STARTTLS (secure=false), 465 → TLS
      requireTLS: true,
      auth:       { user: USER, pass: PASS },
      // nodemailer resolvet IPv4 eerst en houdt IPv6 als fallback; de IPv6-route
      // naar Zivver is onbereikbaar, dus de eerste (IPv4-)poging slaagt meteen.
      // Faal snel met een duidelijke fout i.p.v. eindeloos hangen als de
      // uitgaande SMTP-verbinding geblokkeerd is of niet reageert.
      connectionTimeout: 15000,
      greetingTimeout:   15000,
      socketTimeout:     20000,
      tls: { minVersion: 'TLSv1.2' },
    })

    // ── Zivver per-bericht beveiliging ──────────────────────────────────────────
    // SMS-verificatie (2e factor) als er een bruikbaar mobiel nummer bekend is,
    // anders alleen e-mailverificatie als minimale ondergrens.
    const headers: Record<string, string> = {}
    const phone = toIntlPhone(input.recipientPhone)
    if (phone) {
      headers['zivver-access-right'] = `${input.to} sms ${phone}`
    } else {
      headers['zivver-minimum-recipient-verification'] = 'verification-email'
    }

    try {
      const info = await transporter.sendMail({
        from:    FROM,
        to:      input.to,
        subject: input.subject,        // bevat geen gezondheidsdata
        text:    input.message,        // bevat geen gezondheidsdata
        headers,
        attachments: [{
          filename:    input.attachment.filename,
          content:     input.attachment.content,
          contentType: input.attachment.contentType,
        }],
      })
      return { ok: true, messageId: info.messageId }
    } catch (e) {
      // Log de volledige fout (incl. SMTP-code als ETIMEDOUT/ECONNREFUSED/EAUTH)
      // zodat de oorzaak zichtbaar is in de Coolify-log.
      console.error('[zivver] SMTP-verzending mislukt:', e)
      const msg = e instanceof Error ? e.message : 'Onbekende fout bij Zivver-verzending.'
      const code = (e as { code?: string })?.code
      return { ok: false, error: code ? `${msg} (${code})` : msg }
    }
  },
}
