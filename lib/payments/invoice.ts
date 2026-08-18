import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { createAdminClient } from '@/lib/supabase/admin'
import { COMPANY } from '@/lib/company'
import { sendEmail } from '@/lib/email/send'
import { factuurEmail, creditfactuurEmail } from '@/lib/email/templates'
import { decryptOrderBuyer } from '@/lib/pii/order'

type Admin = ReturnType<typeof createAdminClient>

const BRAND = rgb(0.122, 0.086, 0.514)   // #1f1683
const INK   = rgb(0.118, 0.161, 0.231)   // #1e293b
const MUTED = rgb(0.392, 0.455, 0.545)   // #64748b

function euro(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}€ ${(Math.abs(cents) / 100).toFixed(2).replace('.', ',')}`
}
function dateNL(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

interface InvoiceData {
  number: string; issuedAt: string; type: 'invoice' | 'credit'
  buyerEmail: string; buyerName?: string; buyerAddress?: string; buyerPostalCity?: string
  packageName: string
  netCents: number; vatCents: number; grossCents: number; vatRate: number
  paidAt: string | null
}

// Bouwt een eenvoudige, nette factuur-PDF (A4).
export async function generateInvoicePdf(d: InvoiceData): Promise<Buffer> {
  const doc  = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const W = 595.28
  const M = 56
  const t = (s: string, x: number, y: number, size = 10, f = font, color = INK) => page.drawText(s, { x, y, size, font: f, color })
  const right = (s: string, xRight: number, y: number, size = 10, f = font, color = INK) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color })

  const isCredit = d.type === 'credit'

  // Bedrijfskop
  let y = 792
  t(COMPANY.name, M, y, 16, bold, BRAND); y -= 16
  if (COMPANY.address) { t(COMPANY.address, M, y, 9, font, MUTED); y -= 12 }
  t(`KVK ${COMPANY.kvk}${COMPANY.vat ? ` · btw ${COMPANY.vat}` : ''}`, M, y, 9, font, MUTED)

  // Titel + meta rechts
  right(isCredit ? 'CREDITFACTUUR' : 'FACTUUR', W - M, 790, 18, bold, INK)
  right(`Factuurnummer: ${d.number}`, W - M, 768, 10, font, MUTED)
  right(`Datum: ${dateNL(d.issuedAt)}`, W - M, 754, 10, font, MUTED)

  // Aan
  y = 700
  t('Factuur aan', M, y, 9, bold, MUTED); y -= 15
  if (d.buyerName)       { t(d.buyerName, M, y, 11, bold, INK); y -= 14 }
  if (d.buyerAddress)    { t(d.buyerAddress, M, y, 10, font, INK); y -= 13 }
  if (d.buyerPostalCity) { t(d.buyerPostalCity, M, y, 10, font, INK); y -= 13 }
  t(d.buyerEmail, M, y, 10, font, MUTED)
  y -= 42   // ruimte vóór de tabel — dynamisch onder het adresblok (voorkomt overlap)

  // Tabel
  const cols = { desc: M, excl: 320, rate: 388, vat: 440, incl: W - M }
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.97, 0.98, 0.99) })
  t('Omschrijving', cols.desc + 6, y, 9, bold, MUTED)
  right('Excl. btw', cols.excl + 40, y, 9, bold, MUTED)
  right('Btw %', cols.rate + 20, y, 9, bold, MUTED)
  right('Btw', cols.vat + 20, y, 9, bold, MUTED)
  right('Incl. btw', cols.incl, y, 9, bold, MUTED)
  y -= 26

  t(d.packageName, cols.desc + 6, y, 10, font, INK)
  right(euro(d.netCents), cols.excl + 40, y, 10)
  right(`${Number(d.vatRate)}%`, cols.rate + 20, y, 10)
  right(euro(d.vatCents), cols.vat + 20, y, 10)
  right(euro(d.grossCents), cols.incl, y, 10)
  y -= 18
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) })

  // Totalen
  y -= 24
  const labelX = 400, valX = W - M
  right('Subtotaal (excl. btw)', labelX, y, 10, font, MUTED); right(euro(d.netCents), valX, y, 10); y -= 16
  right(`Btw ${Number(d.vatRate)}%`, labelX, y, 10, font, MUTED); right(euro(d.vatCents), valX, y, 10); y -= 18
  right('Totaal', labelX, y, 12, bold, INK); right(euro(d.grossCents), valX, y, 12, bold, INK)

  // Betaalnotitie
  y -= 40
  if (isCredit) {
    t('Dit is een creditfactuur. Het betaalde bedrag is teruggestort.', M, y, 10, font, MUTED)
  } else {
    t(`Voldaan via Mollie${d.paidAt ? ` op ${dateNL(d.paidAt)}` : ''}. Geen verdere actie nodig.`, M, y, 10, font, MUTED)
  }

  // Voettekst
  const footY = 56
  page.drawLine({ start: { x: M, y: footY + 16 }, end: { x: W - M, y: footY + 16 }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) })
  const foot = [COMPANY.name, `KVK ${COMPANY.kvk}`, COMPANY.vat && `btw ${COMPANY.vat}`, COMPANY.iban && `IBAN ${COMPANY.iban}`, COMPANY.email]
    .filter(Boolean).join('  ·  ')
  t(foot, M, footY, 8, font, MUTED)

  return Buffer.from(await doc.save())
}

// Maakt (idempotent) een factuur voor een order: nummer toewijzen, PDF genereren,
// opslaan in de bucket, record wegschrijven. `created` is false als hij al bestond.
export async function createInvoiceForOrder(
  admin: Admin, orderId: string, type: 'invoice' | 'credit' = 'invoice',
): Promise<{ created: boolean; number: string; pdf: Buffer | null; email: string; firstName: string | null }> {
  const { data: order } = await admin
    .from('vh_order')
    .select('id, email, package_name, amount_cents, vat_cents, vat_rate, paid_at, buyer_first_name, buyer_last_name, buyer_address, buyer_postal_code, buyer_city')
    .eq('id', orderId).single()
  if (!order) throw new Error('Order niet gevonden.')

  // Fase 5 PII-kluis: kopervelden op de order zijn versleuteld — eerst ontsleutelen.
  const buyer = decryptOrderBuyer(order as Parameters<typeof decryptOrderBuyer>[0])
  const firstName = buyer.firstName || null

  const { data: existing } = await admin
    .from('vh_invoice').select('number').eq('order_id', orderId).eq('type', type).maybeSingle()
  if (existing?.number) {
    return { created: false, number: existing.number as string, pdf: null, email: buyer.email, firstName }
  }

  const sign = type === 'credit' ? -1 : 1
  const gross = (order.amount_cents as number) * sign
  const vat   = (order.vat_cents as number) * sign
  const net   = gross - vat
  const rate  = order.vat_rate as number

  const year = new Date().getFullYear()
  const { data: seq, error: seqErr } = await admin.rpc('next_invoice_number', { p_year: year })
  if (seqErr || seq == null) throw new Error('Factuurnummer toewijzen mislukt.')
  // Factuurnummer: VHP{jaar}-{6 cijfers}, bv. VHP2026-000001. De reeks blijft
  // gapless (seq komt uit de atomische teller); alleen de weergave verandert.
  const number = `VHP${year}-${String(seq).padStart(6, '0')}`
  const issuedAt = new Date().toISOString()

  const buyerName = [buyer.firstName, buyer.lastName].filter(Boolean).join(' ').trim()
  const postalCity = [buyer.postalCode, buyer.city].filter(Boolean).join(' ').trim()
  const pdf = await generateInvoicePdf({
    number, issuedAt, type,
    buyerEmail: buyer.email,
    buyerName: buyerName || undefined,
    buyerAddress: buyer.address || undefined,
    buyerPostalCity: postalCity || undefined,
    packageName: order.package_name as string,
    netCents: net, vatCents: vat, grossCents: gross, vatRate: rate,
    paidAt: (order.paid_at as string | null) ?? null,
  })

  const storagePath = `${orderId}/${number}.pdf`
  await admin.storage.from('invoices').upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })

  await admin.from('vh_invoice').insert({
    order_id: orderId, type, year, seq, number,
    net_cents: net, vat_cents: vat, gross_cents: gross, vat_rate: rate,
    storage_path: storagePath, issued_at: issuedAt,
  })

  return { created: true, number, pdf, email: buyer.email, firstName }
}

// Maakt de factuur (indien nieuw) en mailt hem als bijlage. Best-effort.
// Bij een gewone factuur wordt de intake-link meegestuurd, zodat de klant later
// via de mail alsnog verder kan als hij de intake nu niet meteen doet.
export async function issueInvoiceAndEmail(
  admin: Admin, orderId: string, type: 'invoice' | 'credit' = 'invoice', intakeUrl?: string | null,
): Promise<void> {
  const { created, number, pdf, email, firstName } = await createInvoiceForOrder(admin, orderId, type)
  if (!created || !pdf || !email) return

  const { subject, html } = type === 'credit'
    ? creditfactuurEmail({ firstName, number })
    : factuurEmail({ firstName, number, intakeUrl })

  await sendEmail({ to: email, subject, html, attachments: [{ filename: `${number}.pdf`, content: pdf }] })
}
