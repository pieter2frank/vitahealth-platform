// Eigen bedrijfsgegevens voor op de factuur. Naam, KVK en adres zijn bekend;
// btw-id en IBAN zet je via env (die verzinnen we niet). Een geldige factuur
// vereist ook die gegevens — laat je accountant de juiste waarden bevestigen.

export const COMPANY = {
  name:    process.env.COMPANY_NAME    ?? 'Vitahealth BV',
  kvk:     process.env.COMPANY_KVK     ?? '42133916',
  vat:     process.env.COMPANY_VAT     ?? '',        // btw-id, bv NL0000.00.000.B00
  address: process.env.COMPANY_ADDRESS ?? 'Oudhuizerstraat 31, 7382 BS Klarenbeek',
  email:   process.env.COMPANY_EMAIL   ?? 'info@vita-health.nl',
  iban:    process.env.COMPANY_IBAN    ?? '',
  website: process.env.COMPANY_WEBSITE ?? 'vita-health.nl',
}
