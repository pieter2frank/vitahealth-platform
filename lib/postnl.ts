/**
 * Vita Health — PostNL Shipping/Labelling API client.
 * Uitsluitend server-side gebruiken (gebruikt de geheime API key).
 *
 * Flow:
 *   1. Barcode genereren (Barcode-webservice)
 *   2. Label + zending aanmaken (Labelling-webservice) → base64 PDF
 *
 * Alle credentials/config via environment variables. Standaard sandbox.
 */

export interface PostNLReceiver {
  name:       string
  street:     string
  houseNr:    string
  houseNrExt?: string
  zipcode:    string   // bv. 1234AB (zonder spatie)
  city:       string
  country:    string   // bv. NL
}

export interface PostNLConfig {
  baseUrl:            string
  apiKey:             string
  customerCode:       string
  customerNumber:     string
  collectionLocation: string
  productCode:        string
  weightGrams:        string
  barcodeType:        string
  barcodeSerie:       string
  printerType:        string
  sender: {
    company:  string
    street:   string
    houseNr:  string
    zipcode:  string
    city:     string
    country:  string
  }
}

export function getPostNLConfig(): PostNLConfig | null {
  const apiKey         = process.env.POSTNL_API_KEY
  const customerCode   = process.env.POSTNL_CUSTOMER_CODE
  const customerNumber = process.env.POSTNL_CUSTOMER_NUMBER
  if (!apiKey || !customerCode || !customerNumber) return null

  return {
    baseUrl:            process.env.POSTNL_BASE_URL || 'https://api-sandbox.postnl.nl',
    apiKey,
    customerCode,
    customerNumber,
    collectionLocation: process.env.POSTNL_COLLECTION_LOCATION || '',
    productCode:        process.env.POSTNL_PRODUCT_CODE || '2928', // Brievenbuspakje + T&T
    weightGrams:        process.env.POSTNL_WEIGHT_GRAMS || '100',
    barcodeType:        process.env.POSTNL_BARCODE_TYPE || '3S',
    barcodeSerie:       process.env.POSTNL_BARCODE_SERIE || '000000000-999999999',
    // D520BT labelprinter kan max 203 dpi: PostNL adviseert GIF/JPG 200 dpi
    // i.p.v. PDF (hogere resolutie → printer moet gokken waar de bars komen).
    printerType:        process.env.POSTNL_PRINTER_TYPE || 'GraphicFile|GIF 200 dpi',
    sender: {
      company:  process.env.POSTNL_SENDER_COMPANY  || 'Vita Health',
      street:   process.env.POSTNL_SENDER_STREET   || '',
      houseNr:  process.env.POSTNL_SENDER_HOUSENR  || '',
      zipcode:  process.env.POSTNL_SENDER_ZIPCODE  || '',
      city:     process.env.POSTNL_SENDER_CITY     || '',
      country:  process.env.POSTNL_SENDER_COUNTRY  || 'NL',
    },
  }
}

/**
 * Bepaalt MIME-type en bestandsextensie op basis van het PostNL Printertype.
 * GIF/JPG geven een afbeelding terug, PDF een pdf.
 */
export function labelContentType(printerType: string): { mime: string; ext: string } {
  const t = printerType.toUpperCase()
  if (t.includes('GIF')) return { mime: 'image/gif', ext: 'gif' }
  if (t.includes('JPG') || t.includes('JPEG')) return { mime: 'image/jpeg', ext: 'jpg' }
  return { mime: 'application/pdf', ext: 'pdf' }
}

/** Splitst "Wallerstraat 29 A" naar { street, houseNr, houseNrExt }. */
export function splitAddress(line: string): { street: string; houseNr: string; houseNrExt?: string } {
  const m = /^(.*?)\s+(\d+)\s*(.*)$/.exec(line.trim())
  if (!m) return { street: line.trim(), houseNr: '' }
  return { street: m[1].trim(), houseNr: m[2], houseNrExt: m[3] ? m[3].trim() : undefined }
}

function nowStamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Bezorgdatum voor het Brievenbuspakje-product: PostNL vereist een DeliveryDate
 * van 1 dag in de toekomst, formaat dd-MM-yyyy HH:mm:ss. Zondag (PostNL bezorgt
 * dan geen post) wordt doorgeschoven naar maandag.
 */
function deliveryDateNextDay(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  if (d.getDay() === 0) d.setDate(d.getDate() + 1) // zondag → maandag
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} 08:00:00`
}

async function generateBarcode(cfg: PostNLConfig): Promise<string> {
  const url = `${cfg.baseUrl}/shipment/v1_1/barcode?CustomerCode=${encodeURIComponent(cfg.customerCode)}`
    + `&CustomerNumber=${encodeURIComponent(cfg.customerNumber)}`
    + `&Type=${encodeURIComponent(cfg.barcodeType)}&Serie=${encodeURIComponent(cfg.barcodeSerie)}`

  const res = await fetch(url, { headers: { apikey: cfg.apiKey, Accept: 'application/json' } })
  if (!res.ok) {
    throw new Error(`PostNL barcode-fout (${res.status}): ${await res.text()}`)
  }
  const json = await res.json()
  if (!json.Barcode) throw new Error('PostNL gaf geen barcode terug.')
  return json.Barcode as string
}

async function createLabel(cfg: PostNLConfig, barcode: string, receiver: PostNLReceiver, reference?: string): Promise<string> {
  const body = {
    Customer: {
      Address: {
        AddressType: '02',
        CompanyName: cfg.sender.company,
        Street:      cfg.sender.street,
        HouseNr:     cfg.sender.houseNr,
        Zipcode:     cfg.sender.zipcode,
        City:        cfg.sender.city,
        Countrycode: cfg.sender.country,
      },
      CollectionLocation: cfg.collectionLocation,
      CustomerCode:       cfg.customerCode,
      CustomerNumber:     cfg.customerNumber,
    },
    Message: {
      MessageID:        Date.now().toString(),
      MessageTimeStamp: nowStamp(),
      Printertype:      cfg.printerType,
    },
    Shipments: [{
      Addresses: [{
        AddressType: '01',
        Name:        receiver.name,
        Street:      receiver.street,
        HouseNr:     receiver.houseNr,
        ...(receiver.houseNrExt ? { HouseNrExt: receiver.houseNrExt } : {}),
        Zipcode:     receiver.zipcode,
        City:        receiver.city,
        Countrycode: receiver.country,
      }],
      Barcode:             barcode,
      ...(reference ? { Reference: reference } : {}),
      DeliveryDate:        deliveryDateNextDay(), // vereist voor Brievenbuspakje (1 dag vooruit)
      Dimension:           { Weight: cfg.weightGrams },
      ProductCodeDelivery: cfg.productCode,
    }],
  }

  const res = await fetch(`${cfg.baseUrl}/shipment/v2_2/label?confirm=true`, {
    method:  'POST',
    headers: { apikey: cfg.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`PostNL label-fout (${res.status}): ${await res.text()}`)
  }
  const json = await res.json()
  const content = json?.ResponseShipments?.[0]?.Labels?.[0]?.Content
  if (!content) throw new Error('PostNL gaf geen label terug.')
  return content as string // base64 PDF
}

/** Consumenten-volglink. */
export function trackingUrl(barcode: string, zipcode: string, country = 'NL'): string {
  return `https://jouw.postnl.nl/track-and-trace/${barcode}-${country}-${zipcode}`
}

/**
 * Hoofdfunctie: maakt barcode + label aan en geeft alles terug.
 * Optionele `reference` wordt op het label geprint (bv. de kit-codering),
 * zodat zichtbaar is om welke zending het gaat.
 */
export async function createShipment(
  receiver: PostNLReceiver,
  opts?: { reference?: string },
): Promise<{
  barcode: string
  trackingUrl: string
  labelBase64: string
  contentType: string
  ext: string
}> {
  const cfg = getPostNLConfig()
  if (!cfg) throw new Error('PostNL is niet geconfigureerd (ontbrekende environment variables).')

  const barcode = await generateBarcode(cfg)
  const labelBase64 = await createLabel(cfg, barcode, receiver, opts?.reference)
  const { mime, ext } = labelContentType(cfg.printerType)
  return {
    barcode,
    trackingUrl: trackingUrl(barcode, receiver.zipcode, receiver.country),
    labelBase64,
    contentType: mime,
    ext,
  }
}
