# AVG-briefing — gesprek met de AVG-functionaris

_Overzicht van platform, gegevens, maatregelen, dossier en resterende acties_

| | |
|---|---|
| **Versie** | 1.1 |
| **Datum** | 19 augustus 2026 |
| **Doel** | De AVG-functionaris in één document meenemen in het platform, de verwerkte gegevens, de genomen maatregelen, het bestaande dossier en de route naar een AVG-proof en certificeerbare organisatie |
| **Organisatie** | Vitahealth BV — KvK 42133916 — Oudhuizerstraat 31, 7382 BS Klarenbeek — info@vita-health.nl |

---

## 1. Overzicht van het platform — wat doet het?

Vita Health levert een **biomarkertest**: een vingerprik-bloedtest (dried blood spot) die
door het laboratorium van **Nightingale Health** (Helsinki, Finland, EER) wordt geanalyseerd.
Deelnemers krijgen een medisch beoordeelde terugkoppeling over hun metabole gezondheid.
De test stelt geen diagnose en vervangt geen reguliere zorg.

Het digitale platform (maatwerk-webapplicatie, Next.js) ondersteunt de hele keten:

1. **Bestelling & betaling** — de klant bestelt de test online; de betaling verloopt
   rechtstreeks via betaaldienst **Mollie** (wij zien geen rekening- of kaartgegevens).
   Het platform maakt de factuur (naam/adres, 7 jaar fiscale bewaarplicht).
   Resellers kunnen via kortingscodes/deelbare links verwijzen.
2. **Intake** — digitale gezondheids- en geschiktheidsvragenlijst plus
   toestemmingsregistratie (inhoud, tijdstip, versie van het formulier).
3. **Testkit-logistiek** — uitgifte, verzending (PostNL, alleen naam + adres op het label)
   en retourregistratie van de kit; statusflow per kit
   (`received → assigned → retour → sent_nightingale → results_available`).
4. **Laboratoriumanalyse** — pseudonieme batchexport naar Nightingale: samplecode,
   pseudoniem Subject-ID, geboortedatum, geslacht — **geen naam of contactgegevens**.
5. **Uitslag & advies** — resultaten komen beveiligd terug; een AI-hulpmiddel genereert op
   basis van pseudonieme gegevens een **conceptadvies** uit een gecureerde kennisbank;
   een arts/leefstijlarts beoordeelt en stelt vast (human-in-the-loop, art. 22-borging).
   De deelnemer ontvangt de uitslag via **Zivver** (beveiligde e-mail, NTA 7516).
6. **Ondersteunend** — medewerkersportaal met rollen (admin, arts/leefstijlarts,
   medewerker), cliëntdossier met notities, helpdesk, auditlog, anonimiseringsfunctie.

**Domeinen:** `platform.vita-health.nl` (medewerkersportaal, achter login met 2FA),
`vita-health.nl` (website + klantflow), helpdeskportaal.

## 2. Visuele structuur — waar staan de gegevens?

```
Deelnemer/klant
   │  bestelt & betaalt (Mollie ⇢ zelfstandig verantwoordelijke)
   ▼
Website + klantflow ──────────────┐
                                  ▼
                        App-server (VPS, TransIP, NL)
                        · Next.js-applicatie via Coolify
                        · gescheiden control-plane-VPS (deploy/beheer)
                                  │
                                  ▼
                        Database & auth: Supabase (EU)
                        ┌───────────────────────────────────────────┐
                        │ PII-KLUIS (versleuteld, AES-256-GCM)      │
                        │  naam · adres · e-mail · telefoon         │
                        ├───────────────────────────────────────────┤
                        │ PSEUDONIEME KERN (gekoppeld via ID)       │
                        │  vragenlijst · biomarkers · beoordeling   │
                        │  kitstatus · orders (kopers versleuteld)  │
                        └───────────────────────────────────────────┘
   Uitgaande stromen (alle o.b.v. VO, tenzij anders vermeld):
   → Nightingale (lab, FI/EER): samplecode + pseudoniem ID + geb.datum + geslacht
   → Zivver (NL, NTA 7516): uitslagrapport naar de deelnemer
   → Resend (VS, SCC's): transactionele e-mail + factuur-PDF
   → Nebius (EU, Zero Data Retention): pseudoniem casusdocument voor conceptadvies
   → Better Stack (VS/EU, SCC's): pseudonieme auditlog-kopie (geen medische inhoud)
   → PostNL (zelfstandig verantwoordelijke): naam + adres op verzendlabel
```

Kernprincipe: **identiteit en medische data zijn gescheiden**. Identiteitsgegevens staan
uitsluitend versleuteld in de PII-kluis; alle medische en logistieke data hangen aan een
pseudoniem ID. Externe partijen krijgen elk alléén het minimale deel dat zij nodig hebben.

## 3. Typen informatie die worden verzameld

| Categorie | Voorbeelden | Bijzonderheden |
|---|---|---|
| Identiteitsgegevens | naam, adres, e-mail, telefoon | versleuteld in PII-kluis, per veld AES-256-GCM |
| Gezondheidsgegevens (art. 9) | vragenlijstantwoorden, contra-indicaties, biomarkerwaarden, risicoprofielen, medische beoordeling, advies | pseudoniem opgeslagen; grondslag: uitdrukkelijke toestemming (9.2a), evt. 9.2h |
| Bestel- & betaalgegevens | order, factuur (naam/adres), betaalstatus, kortingscode | géén rekening-/kaartgegevens (Mollie); factuur 7 jr fiscaal |
| Logistieke gegevens | kitnummer, batch/lot, vervaldatum, verzend-/retourstatus, samplekwaliteit | |
| Toestemmingsregistratie | inhoud, tijdstip, versie formulier | 5 jaar (verantwoording) |
| Technische gegevens | auditlog (acties, gehashte IP's, tijdstip), sessies | pseudonieme kopie extern (Better Stack) |
| Medewerkergegevens | naam, e-mail, rol, 2FA | rolgebaseerde toegang (RLS) |

## 4. Maatregelen die al zijn genomen

**Techniek — gegevensbescherming**
- PII-kluis: veldniveau-versleuteling (AES-256-GCM) van alle identiteitsgegevens, met
  sleutelversiebeheer en een rotatiemechanisme; sleutels staan uitsluitend in de
  server-omgeving + wachtwoordmanager (nooit in code of database).
- Ook koper-gegevens van bestellingen zijn versleuteld; e-mail-lookup via HMAC-hash.
- Pseudonimisering richting álle externe partijen (lab, AI, logging).
- Anonimiseringsfunctie voor afgeronde dossiers (wist kluis + kopervelden, met audittrail);
  facturen blijven conform fiscale plicht.
- AI-verwerking: EU-endpoints, **Zero Data Retention** actief, geen training op klantdata,
  arts beoordeelt altijd.

**Techniek — platform & infrastructuur**
- 2FA voor medewerkers én voor het beheerpaneel; rolgebaseerde toegang met Row Level
  Security; schrijfacties server-side.
- Auditlog van relevante handelingen + externe pseudonieme kopie.
- Server-hardening beide VPS'en (18-08-2026 afgerond): firewall-allowlists (SSH en
  beheerpaneel alleen vanaf vertrouwde IP's), key-only SSH, fail2ban, automatische
  beveiligingsupdates; TLS overal; database encrypted at rest (Supabase, EU).
- Uitslagen uitsluitend via NTA 7516-gecertificeerde beveiligde mail (Zivver).

**Organisatie & leveranciers**
- Verwerkersovereenkomsten geregeld met 6 van 7 verwerkers (Supabase incl. TIA, TransIP
  VO+SVO, Zivver, Nebius, Resend incl. SOC 2 + pentest-attest, Better Stack), vastgelegd
  in een vaststellingenregister + bewijs-PDF's; subverwerkersregister v1.1.
- Rolduiding Mollie en PostNL (zelfstandig verantwoordelijken) in het verwerkingsregister.
- Jaarplanning beveiliging als agenda-items: maandelijks serveronderhoud, kwartaalritueel
  (sleutels/retentie/auditlog/firewall/toegang), halfjaarlijkse restoretest, jaarreview
  incl. sleutelrotatie en leveranciersbeoordeling.
- Noodplan beveiligingsincident (ook buiten het platform bewaard), documentversiebeheer.

## 5. Documenten die er al zijn (dossier `docs/avg-compliance/`)

_Vrijwel alle beleidsdocumenten dragen nog de status **concept — te toetsen**; dat is
precies waar de AVG-functionaris bij helpt._

| Map | Documenten |
|---|---|
| 01 Juridische grondslag & governance | grondslagnotitie v1.0 · DPIA-concept v1.0 · verwerkingsregister v1.2 (bedrijfsgegevens + rolduiding ingevuld) |
| 02 Verwerkers & leveranciers | dpa-vaststellingen (register) · subverwerkersregister v1.1 · alle DPA/VO-PDF's + assurance-rapporten |
| 03 Beleid & procedures | privacyverklaring-werkversie v1.2 · autorisatiematrix · bewaar- en verwijderbeleid · datalekprocedure · responsible disclosure · security-baseline · toegangsbeheer (JML) |
| 04 Technische beveiliging | storage/PDF-beveiligingschecklist v1.1 |
| 05 Auditing & logging | logging- en auditbeleid v1.0 |
| 06 Toegang & dataminimalisatie | toegang- en dataminimalisatiebeleid v1.0 |
| 07 Betrokkenenrechten | procedure betrokkenenrechten v1.0 |
| 08 Datalek & incidentrespons | datalekregister v1.0 · incidentresponsplan v1.0 |
| 09 Mensen & organisatie | geheimhoudingsverklaring v1.0 · privacy-/securitytraining v1.0 |
| 10 Assurance & testen | test- en assuranceplan v1.0 |
| 11 Wettelijk kader | wettelijk-kader-beoordeling v1.0 (WGBO/Wkkgz/NEN-relevantie) |
| 12 Aansprakelijkheid & verzekering | rolverdeling & aansprakelijkheid v1.0 |
| 13 Agenda & planning | jaarplanning beveiliging v1.0 + iCal (ingepland) |
| Overkoepelend (docs/) | beveiligingsmaatregelen v1.1 (15 hoofdstukken) · PII-kluis: implementatieplan v1.2, AVG-toelichting v1.1, sleutelbeheer & retentie v1.0 · server-hardening-checklist v1.1 · betaalmuur v1.1 · noodplan v1.1 · AVG-actielijst v1.0 |
| Publieksdocumenten | privacyverklaring + deelnemersinformatie (bronnen bijgewerkt met BV-gegevens; PDF's op website) · website privacy- en voorwaardenpagina's |

## 6. Wat moet er nog gebeuren — route naar AVG-proof & certificeerbaar

**A. Juridisch/governance (met de AVG-functionaris)**
1. **FG-plicht beoordelen** (art. 37 AVG): grootschalige verwerking van bijzondere
   categorieën → waarschijnlijk FG verplicht. Besluit + evt. formele aanstelling en
   AP-registratie. _Direct agendapunt voor dit gesprek._
2. **DPIA afronden en toetsen** (art. 35): concept ligt er; risico-inventarisatie tegen
   de huidige architectuur aanleggen en vaststellen.
3. **Juridische toetsing van alle conceptdocumenten** (grondslagnotitie,
   verwerkingsregister, alle beleidsstukken, privacyverklaring) — één toetsingsronde.
4. **Formuleringsbeslissingen publieksdocumenten**: FG-passage, Nightingale-VO-zin,
   leeftijd vs geboortedatum; daarna PDF's opnieuw uitgeven.
5. **Bewaartermijnen definitief vaststellen** in het bewaar- en verwijderbeleid en
   synchroniseren met verwerkingsregister + privacyverklaring (verwijdermechanisme is
   al gebouwd).
6. **Organisatorische invulvelden beleggen**: meldpunt datalekken, meldadres responsible
   disclosure, contactpunt betrokkenenrechten, verantwoordelijke + frequentie
   toegangsreviews, break-glass-procedure, back-upritme.

**B. Contracten & leveranciers**
7. **Nightingale-VO** sluiten (loopt mee in het geplande contractgesprek).
8. Bevestiging vastleggen dat support/analytics geen medische data bevatten.

**C. Techniek (restpunten)**
9. Supabase SSL-enforcement + netwerk-restricties aanzetten.
10. Leesacties (inzage) vollediger loggen (NEN 7513-richting).
11. Publieke PDF's her-exporteren en op beide publicatieplekken vervangen.

**D. Assurance & certificering**
12. **Externe pentest** van platform en infrastructuur.
13. **Gap-analyse NEN 7510/7513** (informatiebeveiliging in de zorg) — bepalen welke
    certificering passend is: NEN 7510 en/of ISO 27001. Realistisch pad:
    gap-analyse → ISMS inrichten (veel bouwstenen bestaan al: beleid, logging,
    jaarplanning, incidentproces) → interne audit → externe certificeringsaudit.
    NB: een "AVG-certificaat" (art. 42) bestaat in NL nauwelijks; certificering loopt
    in de praktijk via NEN 7510/ISO 27001 + aantoonbare AVG-compliance (dit dossier).
14. Halfjaarlijkse restoretest (eerste: feb 2027) en jaarlijkse leveranciersbeoordeling
    (aug 2027) — al ingepland.

**E. Mensen & proces**
15. Training + geheimhoudingsverklaringen uitrollen zodra er medewerkers bij komen.
16. Kwartaalritueel uitvoeren én de uitkomsten vastleggen (aantoonbaarheid).

**Voorstel gespreksagenda AVG-functionaris:** (1) FG-plicht en rol, (2) DPIA-toetsing,
(3) toetsingsronde beleidsdocumenten, (4) bewaartermijnen, (5) certificeringsambitie en
-route, (6) afspraken over periodiek overleg.

---

## Bijlagen bij dit gesprek

| Bijlage | Waarom meenemen | Vindplaats |
|---|---|---|
| **PII-kluis — toelichting voor de AVG-functionaris v1.1** | Legt de versleutelings- en pseudonimiseringsaanpak uit in gewone taal, geschreven voor precies deze doelgroep | Word: `docs/pii-kluis-toelichting-avg-v1.1.docx` · markdown: `docs/avg-compliance/pii-kluis-toelichting-avg-v1.1.md` |
| Beveiligingsmaatregelen v1.1 | Het overkoepelende maatregelen-document (15 hoofdstukken) als naslagwerk bij hoofdstuk 4 | `docs/beveiligingsmaatregelen-vita-health-v1.1.docx` |
| Subverwerkersregister v1.1 + dpa-vaststellingen | Bewijs bij hoofdstuk 2 en 5: alle partijen, overeenkomsten en subverwerkers | `docs/avg-compliance/02-verwerkers-leveranciers/` |
