# Betaalmuur & facturatie — Vita Health

_Functioneel en technisch ontwerp_

| | |
|---|---|
| **Versie** | 1.1 |
| **Datum** | 12 augustus 2026 |
| **Status** | Definitief — geïmplementeerd |
| **Eigenaar** | Vita Health |
| **Wijzigingen v1.1** | Hoofdstuk 10 (Resellers) toegevoegd; datamodel, migraties en deploy bijgewerkt. |

> Markdown-versie van `docs/betaalmuur-vita-health-v1.1.docx`. Bij een inhoudelijke
> wijziging: nieuw bestand met opgehoogd versienummer (v1.1 klein / v2.0 groot) en
> de oude versie als historie laten staan.

---

## 1. Inleiding en doel

Dit document beschrijft de **betaalmuur** van het Vita Health platform: de laag die vóór de bestaande intake is geplaatst en waarmee een klant een biomarker-testpakket koopt, betaalt en een factuur ontvangt. Na betaling gaat de klant naadloos over in de bestaande intake (persoonsgegevens, toestemmingen en vragenlijst).

De betaalmuur bestaat uit vijf onderdelen die samen één flow vormen: (1) bestellen en betalen, (2) facturatie, (3) overdracht naar de intake, (4) restitutie met creditfacturen, en (5) beheer (bestellingen, omzet en kortingscodes). Betalingen lopen via **Mollie**; facturen worden als PDF gegenereerd en per e-mail verstuurd. Daarnaast kunnen **resellers** via een eigen kortingscode klanten werven (hoofdstuk 10).

Dit document is bedoeld voor ontwikkelaars, beheerders en de functioneel/juridisch verantwoordelijken. Voor de AVG-aspecten wordt verwezen naar de overige documentatie in `docs/avg-compliance/`.

## 2. Architectuur op hoofdlijnen

De klantflow verloopt in vijf stappen, waarbij de betaling **stap 1** is en de intake de stappen 2 tot en met 5 vormt:

1. **Bestellen** — de klant kiest een pakket op de bestelpagina (`/bestellen/[slug]`), vult e-mail, naam en adres in en past eventueel een kortingscode toe.
2. **Betalen** — via de gehoste Mollie-checkout. Bij een 100%-korting (€0) wordt Mollie overgeslagen.
3. **Gegevens** — controleren/aanvullen van naam, adres en geboortedatum (voorgevuld vanuit de bestelling).
4. **Toestemming** — de klant geeft toestemming voor het verwerken van gezondheidsgegevens.
5. **Vragenlijst** — de leefstijl-/gezondheidsvragenlijst, waarna de arts de intake beoordeelt.

De **bestelling** (`vh_order`) is de bron van waarheid voor de betaalstap; de bestaande status-machine van de aanmelding blijft ongewijzigd. Er wordt pas een cliëntrecord aangemaakt of gekoppeld op het moment van betaling, zodat er geen "wees"-cliënten zonder betaling ontstaan.

Mollie kent **geen productcatalogus**: de pakketten leven in de eigen database. Mollie Connect is niet nodig (dat is alleen voor marktplaatsen). De koppeling met een betaling verloopt via het opgeslagen `mollie_payment_id`.

## 3. Datamodel

Alle tabellen dragen het prefix `vh_`. De kernkolommen:

| Tabel | Doel en kernvelden |
|---|---|
| `vh_package` | Pakketten. `slug`, `name`, `price_cents` (INCLUSIEF btw), `vat_rate` (btw-tarief per pakket), `includes_consult`, `active`, `sort_order`. |
| `vh_discount_code` | Kortingscodes. `code` (uniek, hoofdletters), `type` (percent\|fixed), `value`, optioneel `package_id`, `reseller_id`, `max_uses`, `used_count`, `valid_until`, `active`, `note`. |
| `vh_order` | Bestelling. `package_id` + bevroren `package_name`/bedragen (`amount_cents`, `vat_cents`, `vat_rate`), `email`, koper (`buyer_*`), `discount_code`/`discount_cents`, `reseller_id`, `status`, `mollie_payment_id`, `paid_at`, en restitutie-/stopvelden (`refunded_at`, `mollie_refund_id`, `refund_reason`). |
| `vh_invoice` | Factuur/creditfactuur. `order_id`, `type` (invoice\|credit), `year`, `seq`, uniek `number`, bedragen, `storage_path`. Uniek per (order, type). |
| `vh_invoice_seq` | Teller per jaar voor doorlopende (gapless) factuurnummering. |
| `vh_reseller` | Reseller (naam, contactpersoon, e-mail, telefoon, adres, KVK, `active`, notitie). Gekoppeld via `reseller_id` op `vh_discount_code` en `vh_order`. Zie hoofdstuk 10. |

De orderstatus doorloopt: `open` → `paid` (of `failed`/`expired`/`canceled`) en kan daarna naar `refunded`. Bedragen worden bij het aanmaken van de order **bevroren** op de order, zodat een latere prijswijziging van een pakket historische bestellingen en facturen niet beïnvloedt.

## 4. Databasemigraties

| Migratie | Inhoud |
|---|---|
| `070_payments` | vh_package, vh_discount_code, vh_order + RLS-leespolicies; seed van de twee startpakketten. |
| `071_invoices` | vh_invoice, vh_invoice_seq, RPC `next_invoice_number(p_year)` (gapless), privé storage-bucket `invoices`. |
| `072_status_payment` | Status-RPC `get_enrollment_status_by_token` uitgebreid met betaalinfo (has_order, paid, paid_at). |
| `073_order_buyer` | Kopergegevens op de order (`buyer_first_name`/`last_name`/`address`/`postal_code`/`city`). |
| `074_refunds` | Restitutie-/stopvelden op de order; enrollment-status `geannuleerd`; status-RPC uitgebreid met `order_status`/`refunded_at`. |
| `076_resellers` | vh_reseller + `reseller_id` op vh_discount_code (on delete set null) en vh_order; indexen en RLS-leespolicy. |

De migraties worden uitgevoerd via de Supabase SQL Editor. Migraties zijn idempotent opgezet (`create ... if not exists`, `drop policy if exists`) zodat herhaald draaien veilig is.

## 5. Betaling via Mollie

De betaling gebruikt de Mollie Payments API rechtstreeks via REST (geen SDK-afhankelijkheid). Test- versus live-modus zit in de sleutel zelf (`test_…` / `live_…`).

### 5.1 Checkout

`POST /api/payments/checkout` valideert pakket, e-mail, naam en adres, valideert een eventuele kortingscode, maakt de `vh_order` aan met bevroren bedragen en start een Mollie-betaling. Bij een eindbedrag van **€0** (bijv. een 100%-kortingscode) wordt Mollie overgeslagen en de order direct afgehandeld.

### 5.2 Webhook en statuscontrole

Mollie roept de **webhook** (`/api/payments/webhook`) aan met alleen een betaling-id. De status wordt nooit uit de request-body vertrouwd: de betaling wordt actief bij Mollie opgehaald en geverifieerd. De verwerking is idempotent en geeft bij een fout een 500 terug zodat Mollie het opnieuw probeert.

Omdat de browser-redirect vóór de webhook kan aankomen, doet de afrondpagina (`/bestellen/afronden`) een live statuscheck via `/api/payments/status`. Zodra de betaling `paid` is, wordt de order afgehandeld en de intake-link getoond.

### 5.3 Afhandeling van een betaalde order

`settleOrderPaid` koppelt of maakt de cliënt op basis van het e-mailadres (en vult lege naam-/adresvelden bij vanuit de bestelling), verbruikt de kortingscode, zet de order op `paid`, maakt een intake-token en genereert + mailt de factuur. De stappen zijn idempotent (guard op `client_id`), zodat webhook en statuscheck elkaar niet dubbel uitvoeren.

## 6. Facturen

Voor elke betaalde order wordt een factuur gegenereerd. De nummering is **doorlopend en gatenloos** (wettelijke eis): een atomaire RPC `next_invoice_number(p_year)` reikt per jaar een oplopend volgnummer uit, resulterend in nummers als `2026-0007`.

De PDF wordt met **pdf-lib** opgebouwd (bedrijfskop, koper, specificatie met btw, totalen) en opgeslagen in de privé storage-bucket `invoices`. De factuur wordt als bijlage per e-mail verstuurd. De e-mail gebruikt hetzelfde huisstijl-template (`shell()`) als de overige Vita Health-mails (paarse header, groene accentlijn, knop, footer). Bij een gewone factuur staat er een knop naar de intake; de tekst luidt: _"Als je de intake later wilt afronden, kan onderstaande link worden gebruikt."_

Bedrijfsgegevens (naam, KVK, btw-nummer, adres, IBAN) komen uit environmentvariabelen (`lib/company.ts`) en worden nooit in code verzonnen.

## 7. Overdracht naar de intake

Na betaling ontvangt de klant een intake-hervat-link (`/portal/aanmelden?token=…`). Dit hergebruikt het bestaande uitnodig-mechanisme: een `vh_intake_token` per cliënt en de RPC `resolve_intake_token`, die naam, adres, e-mail en dergelijke teruggeeft. Het intake-formulier vult stap 1 en 2 voor en bepaalt de startstap op basis van de reeds ingevulde gegevens (geboortedatum is het kernsignaal dat de persoonsgegevens echt zijn doorlopen).

De link staat ook in de factuurmail en blijft geldig, zodat de klant de intake op een later moment kan afronden.

## 8. Restitutie en creditfacturen

Een **admin** kan een betaalde bestelling terugbetalen via de Bestellingen-pagina. `refundOrder` voert vier stappen uit:

1. Restitutie bij Mollie (overgeslagen bij een €0-order).
2. Order op `refunded` met tijdstip, refund-id en reden.
3. Het cliënt-traject op de terminale status `geannuleerd`.
4. Het genereren + mailen van een **creditfactuur**.

De actie is idempotent en wordt vastgelegd in de auditlog.

Klanten vragen een stopzetting/terugbetaling aan **via de helpdesk**; er is bewust geen zelf-service stopknop in het klantportaal. Na terugbetaling toont het statusoverzicht een "traject beëindigd"-melding met de terugbetaaldatum.

## 9. Beheer (admin)

Drie beheerschermen zijn uitsluitend voor de **admin**-rol beschikbaar (in het uitklapbare Admin-menu):

- **9.1 Bestellingen** — overzicht van alle bestellingen met status en filters (alle/betaald/terugbetaald/overig), stat-tegels (aantal betaald + omzet, netto-omzet, terugbetaald) en de **terugbetaal-actie** met bevestigingsdialoog.
- **9.2 Omzet en btw** — financieel dashboard met KPI-tegels (netto-omzet incl./excl. btw, af te dragen btw, aantal betaalde bestellingen, gemiddelde orderwaarde, terugbetaald), een staafgrafiek omzet per maand (laatste 12 maanden), omzet per pakket en een btw-overzicht per tarief met totalen. Handig voor de btw-aangifte.
- **9.3 Kortingscodes** — aanmaken en beheren van kortingscodes: percentage of vast bedrag, optioneel gekoppeld aan een specifiek pakket, met maximaal aantal keer gebruik, geldigheidsdatum en een interne notitie. Codes kunnen worden geactiveerd/gedeactiveerd of verwijderd en werken direct op de bestelpagina. Codes tot en met 100% zijn mogelijk (die slaan de betaling over).

## 10. Resellers

Resellers werven klanten via een eigen kortingscode. De functionaliteit bouwt voort op de kortingscode-engine (hoofdstuk 9.3): een reseller-code is een gewone kortingscode met een reseller eraan gekoppeld. Beheer is uitsluitend voor de admin.

### 10.1 Datamodel (migratie 076)

- `vh_reseller` — naam, contactpersoon, e-mail, telefoon, adres, KVK, `active`, notitie.
- `reseller_id` op `vh_discount_code` — koppelt een code aan een reseller; bij het verwijderen van de reseller wordt de code ontkoppeld (niet weggegooid).
- `reseller_id` op `vh_order` — vastgelegd bij het afrekenen, zodat de omzet-toerekening stabiel blijft, ook als de code later wijzigt of verdwijnt.

### 10.2 Beheer (admin)

`/resellers` toont per reseller het aantal keren gebruikt en de bruto-/netto-omzet, met een knop om een reseller aan te maken. `/resellers/[id]` toont de gegevens (bewerken, (de)activeren, verwijderen — verwijderen wordt geweigerd zodra er bestellingen aan de reseller hangen, dan deactiveren), de kortingscodes van de reseller (aanmaken/beheren via de bestaande engine), de cijfers, en per code een knop om de deelbare bestellink te kopiëren.

### 10.3 Klantkant

De reseller deelt een link `/bestellen?code=XYZ`. Die toont op het pakketoverzicht een reseller-banner en draagt de code mee naar het gekozen pakket, waar hij op de betaalpagina voor-ingevuld staat. Zodra de code is toegepast toont de paywall: _"Deze code is verstrekt door {reseller}"_.

### 10.4 Rapportage

- Keer gebruikt = aantal **betaalde** bestellingen met die reseller.
- Omzet wordt zowel **bruto (incl. btw)** als **netto (excl. btw)** getoond, plus de gegeven korting.
- Terugbetaalde bestellingen (status `refunded`) vallen buiten de omzet.
- Er wordt bewust **geen commissie/uitbetaling** bijgehouden — de rapportage is puur voor inzicht.

## 11. Klant-statusoverzicht

Het bestaande statusoverzicht (`/portal/status/[token]`) toont, als er een bestelling is, een extra stap "Betaling voldaan" vóór de intakestappen. Bij een terugbetaling verschijnt in plaats van de tijdlijn een "traject beëindigd"-melding.

## 12. Beveiliging en AVG

- **Mollie als verwerker** — Mollie verwerkt de betaling en houdt de kaart-/rekeninggegevens; het platform slaat die niet op. Mollie hoort in het verwerkersregister thuis (zie `02-verwerkers-leveranciers/`).
- **Minimale opslag** — op de order staan alleen het betaalbedrag, btw, status en het Mollie-betaling-id; geen betaalmiddelgegevens.
- **Webhook-verificatie** — de betaalstatus wordt altijd bij Mollie opgehaald en nooit uit de request-body vertrouwd.
- **Gatenloze nummering** — doorlopende factuurnummers zijn een wettelijke eis en worden atomair uitgereikt.
- **Rolscheiding** — de beheerschermen (inclusief resellers) en de refund-API zijn admin-only; de `service_role`-client wordt uitsluitend server-side gebruikt.
- **Auditlog** — de terugbetaling (statuswijziging van het traject) wordt vastgelegd; kortingscode- en reseller-beheer vallen buiten de medische auditlog en worden daar niet in opgenomen.

## 13. Configuratie (environment)

| Variabele | Betekenis |
|---|---|
| `MOLLIE_API_KEY` | Mollie-sleutel; `test_…` (sandbox) of `live_…` (productie). |
| `NEXT_PUBLIC_PLATFORM_URL` | Basis-URL van het medewerkersportaal, gebruikt voor redirect- en webhook-URLs én de deelbare reseller-bestellink. |
| `NEXT_PUBLIC_PORTAL_URL` | Basis-URL van het klantportaal, gebruikt voor de intake-hervat-link. |
| `COMPANY_NAME` / `COMPANY_KVK` | Bedrijfsnaam en KVK op de factuur (naam "Vitahealth BV", KVK 42133916 bekend). |
| `COMPANY_VAT` / `COMPANY_ADDRESS` / `COMPANY_IBAN` | Btw-nummer, adres en IBAN op de factuur — in te vullen via environment. |
| _(bestaand)_ e-mail + `AUDIT_HASH_SALT` | Bestaande mailverzending (Resend) en auditlog-hashing worden hergebruikt. |

## 14. Deploy en migraties

1. Draai de migraties **070 t/m 076** in de Supabase SQL Editor (074 hoort bij de restitutie, 076 bij de resellers).
2. Zet de environmentvariabelen (zie hoofdstuk 13), met minimaal `MOLLIE_API_KEY`, `NEXT_PUBLIC_PLATFORM_URL` en de `COMPANY_*`-factuurgegevens.
3. Redeploy de applicatie.
4. Voer één sandbox-doorloop uit: bestellen → betalen → factuur ontvangen → intake → (in Bestellingen) terugbetalen → creditfactuur; en maak een kortingscode/reseller aan en pas die toe.

De webhook is alleen op de gedeployde omgeving te testen; Mollie kan geen localhost bereiken.

## 15. Openstaande punten

- Het consult (pakket met terugkoppeling leefstijlarts) wordt later handmatig ingepland.
- Restituties zijn altijd volledig; gedeeltelijke terugbetaling is (nog) niet voorzien.
- De stop-/reden-kolommen op de order blijven ongebruikt aanwezig sinds het zelf-service stopverzoek is verwijderd (geen destructieve migratie uitgevoerd).
- Bij resellers wordt geen commissie/uitbetaling bijgehouden (bewuste keuze — alleen inzicht); een reseller-login met eigen inzage is een mogelijke toekomstige uitbreiding.

---

_Bijbehorend brondocument: `docs/betaalmuur-vita-health-v1.1.docx`._
