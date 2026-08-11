import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { createAdminClient } from '@/lib/supabase/admin'
import { COMPANY } from '@/lib/company'
import { sendEmail } from '@/lib/email/send'

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
  buyerEmail: string; packageName: string
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
  t('Factuur aan', M, y, 9, bold, MUTED); y -= 14
  t(d.buyerEmail, M, y, 11, font, INK)

  // Tabel
  y = 648
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
): Promise<{ created: boolean; number: string; pdf: Buffer | null; email: string }> {
  const { data: order } = await admin
    .from('vh_order')
    .select('id, email, package_name, amount_cents, vat_cents, vat_rate, paid_at')
    .eq('id', orderId).single()
  if (!order) throw new Error('Order niet gevonden.')

  const { data: existing } = await admin
    .from('vh_invoice').select('number').eq('order_id', orderId).eq('type', type).maybeSingle()
  if (existing?.number) {
    return { created: false, number: existing.number as string, pdf: null, email: order.email as string }
  }

  const sign = type === 'credit' ? -1 : 1
  const gross = (order.amount_cents as number) * sign
  const vat   = (order.vat_cents as number) * sign
  const net   = gross - vat
  const rate  = order.vat_rate as number

  const year = new Date().getFullYear()
  const { data: seq, error: seqErr } = await admin.rpc('next_invoice_number', { p_year: year })
  if (seqErr || seq == null) throw new Error('Factuurnummer toewijzen mislukt.')
  const number = `${year}-${String(seq).padStart(4, '0')}`
  const issuedAt = new Date().toISOString()

  const pdf = await generateInvoicePdf({
    number, issuedAt, type,
    buyerEmail: order.email as string,
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

  return { created: true, number, pdf, email: order.email as string }
}

// Maakt de factuur (indien nieuw) en mailt hem als bijlage. Best-effort.
export async function issueInvoiceAndEmail(admin: Admin, orderId: string, type: 'invoice' | 'credit' = 'invoice'): Promise<void> {
  const { created, number, pdf, email } = await createInvoiceForOrder(admin, orderId, type)
  if (!created || !pdf || !email) return

  const isCredit = type === 'credit'
  const subject = isCredit ? `Creditfactuur ${number} — Vita Health` : `Factuur ${number} — Vita Health`
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#1e293b;line-height:1.6">
      <p>Beste,</p>
      <p>${isCredit
        ? `In de bijlage vind je de creditfactuur <strong>${number}</strong> voor je terugbetaling.`
        : `Bedankt voor je bestelling. In de bijlage vind je je factuur <strong>${number}</strong>.`}</p>
      <p style="color:#64748b;font-size:13px">Vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683">helpdesk</a>.</p>
      <p style="color:#94a3b8;font-size:13px">Vita Health</p>
    </div>`

  await sendEmail({ to: email, subject, html, attachments: [{ filename: `${number}.pdf`, content: pdf }] })
}
