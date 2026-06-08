# Changelog

Alle noemenswaardige wijzigingen aan het Vita Health Platform worden hier
bijgehouden. Versienummers volgen [SemVer](https://semver.org/lang/nl/):
`MAJOR.MINOR.PATCH`.

- **MAJOR** — grote wijziging die bestaand gedrag verandert of omgooit
- **MINOR** — nieuwe functie, achterwaarts compatibel
- **PATCH** — bugfix of kleine correctie

---

## [1.0.0] — 2026-06-08

Eerste officiële versie. Het platform is live en dekt de volledige keten van
aanmelding tot en met uitslag, met beveiliging en beheer.

### Aanmelding & portaal (cliënt)
- Aanmeldformulier in 4 stappen: persoonsgegevens, adres, toestemmingen, vragenlijst
- Uitnodigingen per e-mail met persoonlijke intakelink; uitgenodigde cliënt
  start direct op stap 1 met voorgevulde naam en e-mail
- Hervatten van een onderbroken aanmelding; duidelijke statusmelding bij terugkeer
  (voltooid / afgewezen / on hold / nog bezig)
- Geschiktheidscheck (stap 4) met uitsluitingscriteria; verklaring wordt
  vastgelegd inclusief getoonde tekst en tijdstip
- Statuspagina per cliënt via beveiligde token
- Datumvelden in dd/mm/jjjj, onafhankelijk van browser-locale
- Productnaam "Vita Health Check" consequent doorgevoerd

### Vragenlijsten
- Onboarding-vragenlijst met schaal- en keuzevragen, schaallabels (laag/hoog)
- Leeftijd wordt automatisch uit geboortedatum berekend
- Resultatenweergave voor arts/medewerker

### Testkits & logistiek
- Testkitbeheer met statusflow (ontvangen → toegewezen → opsturen → retour →
  verzonden Nightingale → uitslag)
- Barcode-scannen met directe focus voor snel achter elkaar inscannen
- Bulk-acties en selectievakken in de kitlijst
- Batches naar Nightingale met automatisch gegenereerde batchcode
  (NL-NH-jjjj-00001/010)
- Excel-export per batch

### Dashboard & werkverdeling
- Overzicht van testkits en cliënten per status
- Unified actietabel: één actie per rij, met rol, en toewijzing aan medewerkers
  (rol-bewust); rijen klikbaar naar de betreffende pagina
- Realtime melding bij nieuwe aanvragen

### Beveiliging & compliance
- Verplichte 2FA voor medewerkers, automatische uitlog bij inactiviteit
- Rate limiting op login
- Medische auditlog (NEN 7513) met externe kopie (Better Stack)
- Geautomatiseerde alerts (bulk-inzage, exports buiten werktijden, e.d.)
- Toestemmingen beheerbaar met versiebeheer (admin)
- Beheer van medewerkers en uitnodigingen (admin)
- GDPR-documenten: deelnemersinformatie en privacyverklaring

### Infrastructuur
- Deployment via Coolify met multi-stage Docker build
- Databasemigraties 001 t/m 035
- Noodplan en deploymenthandleiding gedocumenteerd

---

<!--
Sjabloon voor een volgende versie — kopieer bovenaan bij een nieuwe release:

## [1.1.0] — JJJJ-MM-DD

### Toegevoegd
- ...

### Gewijzigd
- ...

### Opgelost
- ...
-->
