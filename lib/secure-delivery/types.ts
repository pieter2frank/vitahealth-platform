// Vita Health — beveiligde bezorging van rapporten (bijzondere persoonsgegevens).
//
// Uitwisselbare provider-interface. De eerste implementatie is Zivver; later kan
// hier bijvoorbeeld Zorgmail naast bestaan zonder de rest van de code te raken.

export interface SecureReportInput {
  /** E-mailadres van de ontvanger. */
  to: string
  /** Naam van de ontvanger (voor de aanhef). */
  recipientName: string
  /** Mobiel nummer voor SMS-verificatie (sterke tweede factor). */
  recipientPhone?: string | null
  /** Onderwerp — bevat GEEN gezondheidsdata. */
  subject: string
  /** Begeleidende tekst — bevat GEEN gezondheidsdata. */
  message: string
  /** De bijlage (het rapport). */
  attachment: {
    filename: string
    content: Buffer
    contentType: string
  }
}

export interface SecureDeliveryResult {
  ok: boolean
  messageId?: string
  error?: string
}

export interface SecureDeliveryProvider {
  /** Korte naam, bv. 'zivver' — ook gebruikt in de auditlog. */
  readonly name: string
  /** True zodra de benodigde credentials/config aanwezig zijn. */
  isConfigured(): boolean
  /** Verstuurt het rapport beveiligd naar de ontvanger. */
  sendReport(input: SecureReportInput): Promise<SecureDeliveryResult>
}
