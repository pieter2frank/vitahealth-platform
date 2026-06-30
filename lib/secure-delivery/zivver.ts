import type { SecureDeliveryProvider, SecureReportInput, SecureDeliveryResult } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Zivver — beveiligde verzending via de Zivver REST API.
//
// ⚠️  IN TE VULLEN: de exacte endpoint-URL, headers en veldnamen (en de manier
//     waarop bijlagen worden meegestuurd) moeten worden geverifieerd tegen de
//     officiële Zivver API-documentatie zodra je een zakelijk account met
//     API-toegang + credentials hebt. Alle Zivver-specifieke logica zit bewust
//     alléén in dit bestand, zodat de rest van het platform niet wijzigt.
//
// Benodigde env-variabelen:
//   ZIVVER_API_URL      (bv. https://api.zivver.com — verifieer in de docs)
//   ZIVVER_API_KEY      (API-token van het functionele account)
//   ZIVVER_ACCOUNT_ID   (afzender / functioneel account)
// ─────────────────────────────────────────────────────────────────────────────

const ZIVVER_API_URL    = process.env.ZIVVER_API_URL ?? 'https://api.zivver.com'
const ZIVVER_API_KEY    = process.env.ZIVVER_API_KEY ?? ''
const ZIVVER_ACCOUNT_ID = process.env.ZIVVER_ACCOUNT_ID ?? ''

export const zivverProvider: SecureDeliveryProvider = {
  name: 'zivver',

  isConfigured() {
    return Boolean(ZIVVER_API_KEY && ZIVVER_ACCOUNT_ID)
  },

  async sendReport(input: SecureReportInput): Promise<SecureDeliveryResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'Zivver niet geconfigureerd (ZIVVER_API_KEY / ZIVVER_ACCOUNT_ID ontbreken).' }
    }

    // ── SKELET — veldnamen/endpoint verifiëren tegen de Zivver API-docs ───────
    const payload = {
      account: ZIVVER_ACCOUNT_ID,
      recipients: [{
        email: input.to,
        // Tweede factor: SMS-verificatie op het mobiele nummer als dat er is,
        // anders verificatie via e-mail (zwakker — mobiel nummer is sterk aanbevolen).
        verification: input.recipientPhone
          ? { method: 'sms', phone: input.recipientPhone }
          : { method: 'email' },
      }],
      subject: input.subject,
      body: input.message,
      attachments: [{
        filename:    input.attachment.filename,
        contentType: input.attachment.contentType,
        content:     input.attachment.content.toString('base64'),
      }],
    }

    try {
      const res = await fetch(`${ZIVVER_API_URL}/api/v1/messages`, {
        method: 'POST',
        headers: {
          Authorization:  `Bearer ${ZIVVER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return { ok: false, error: `Zivver API ${res.status}: ${text.slice(0, 300)}` }
      }

      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      return { ok: true, messageId: (data.id as string | undefined) ?? undefined }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout bij Zivver-verzending.' }
    }
  },
}
