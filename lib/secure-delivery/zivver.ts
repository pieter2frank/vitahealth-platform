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
// ⚠️  De per-bericht ontvangersverificatie (SMS als 2e factor) verloopt bij de
//     SMTP-gateway via Zivver-beleid en/of specifieke headers die op deze
//     docpagina niet staan. Bevestig de header bij Zivver-support; zet 'm daarna
//     hieronder (zie het gemarkeerde blok). Zonder die header wordt het bericht
//     nog steeds beveiligd volgens je organisatie-standaard.
// ─────────────────────────────────────────────────────────────────────────────

const HOST = process.env.ZIVVER_SMTP_HOST ?? 'smtp.zivver.com'
const PORT = Number(process.env.ZIVVER_SMTP_PORT ?? 587)
const USER = process.env.ZIVVER_SMTP_USER ?? ''
const PASS = process.env.ZIVVER_SMTP_PASS ?? ''
const FROM = process.env.ZIVVER_FROM ?? ''

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
    })

    // ── Zivver-beveiligingsheaders (bevestig de exacte namen bij Zivver-support) ─
    // Placeholder voor per-bericht instellingen zoals SMS-verificatie op het
    // mobiele nummer. Zolang deze niet gezet zijn, geldt je org-standaard.
    const headers: Record<string, string> = {}
    // Voorbeeld (NAAM VERIFIËREN): SMS-verificatie op het mobiele nummer aanzetten.
    // if (input.recipientPhone) headers['X-Zivver-...'] = input.recipientPhone

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
      return { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout bij Zivver-verzending.' }
    }
  },
}
