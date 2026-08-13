# PII-kluis — toelichting voor de AVG-functionaris

_Scheiding en versleuteling van identificerende persoonsgegevens, in gewone taal_

| | |
|---|---|
| **Versie** | 1.0 |
| **Datum** | 13 augustus 2026 |
| **Status** | Definitief — maatregel geïmplementeerd |
| **Doelgroep** | AVG-functionaris / privacy-verantwoordelijke |
| **Technisch zusterdocument** | `pii-kluis-implementatieplan-v1.0` |

> Dit document legt in niet-technische taal uit wélke beveiligingsmaatregel is genomen,
> waartegen die beschermt en wat dit betekent voor de AVG-huishouding. De technische
> uitwerking (datamodel, cryptografie, fasering, rollback) staat in het zusterdocument.

---

## 1. Wat was de situatie?

In de database stonden twee soorten gegevens naast elkaar in dezelfde tabel: **wie iemand
is** (naam, adres, e-mail, telefoon, geboortedatum) en **wat we medisch van diegene weten**
(uitslagen, vragenlijsten, adviezen). Wie de database te pakken zou krijgen — via een
gestolen backup, een gelekt wachtwoord of een inbraak bij de databaseleverancier — had
daarmee in één klap complete, op naam herleidbare medische dossiers.

## 2. Wat is er gedaan?

De twee soorten gegevens zijn **fysiek uit elkaar gehaald**, volgens een kluis-principe:

1. **Het medische dossier is voortaan naamloos.** Dossiers (uitslagen, vragenlijsten,
   status) hangen aan een betekenisloos volgnummer — een pseudoniem. In het dossier zelf
   staat geen naam, adres of geboortedatum meer.

2. **De identificerende gegevens liggen in een aparte kluis.** Naam, adres, e-mail,
   telefoon en geboortedatum staan in een aparte tabel en zijn daar **versleuteld** — elk
   veld afzonderlijk, met sterke encryptie (AES-256, de standaard die ook banken
   gebruiken).

3. **De sleutel van de kluis ligt buiten het pand.** De sleutel om de versleuteling te
   openen staat níet in de database, maar uitsluitend op de eigen applicatieserver (met
   een reservekopie in de wachtwoordkluis). Wie alleen de database steelt, heeft dus een
   kluis zonder sleutel: naamloze medische data plus onleesbare tekenbrij.

4. **Alleen de applicatie kan de kluis openen, via één deur.** Alle toegang tot de kluis
   loopt door één centrale plek in de software. De database weigert bovendien elke andere
   toegang tot de kluistabel — een dubbel slot. Medewerkers zien in het systeem gewoon
   namen (nodig voor hun werk), maar alleen doordat de applicatie het voor hen ontsleutelt
   nadat zij zijn ingelogd met tweestapsverificatie.

5. **Zoeken zonder te onthullen.** Om een klant op e-mailadres terug te vinden
   (bijvoorbeeld bij een herhaalbestelling) wordt een onomkeerbare "vingerafdruk" van het
   adres gebruikt. Matchen kan zo zonder het adres leesbaar op te slaan.

## 3. Waartegen beschermt dit?

| Scenario | Vóór | Nu |
|---|---|---|
| Gestolen database-backup | volledige dossiers op naam | naamloze dossiers + onleesbare kluis |
| Gelekt databasewachtwoord / SQL-aanval | idem | idem |
| Datalek bij de databaseleverancier (Supabase) | idem | idem |
| Medewerker kijkt verder dan nodig | mogelijk | kluis alleen via de applicatie, met rolcontrole |

**Restrisico, eerlijk benoemd**: tegen een aanvaller die de *applicatieserver* volledig
overneemt beschermt deze maatregel niet — die server moet de sleutel immers zelf kunnen
gebruiken. Daarom is parallel de server-omgeving extra beveiligd (firewall-allowlists op
het beheerpaneel, tweestapsverificatie, hardening-checklist — zie
`server-hardening-checklist-v1.0` in dit dossier).

## 4. Betekenis voor de AVG-huishouding

- **Passende technische maatregel (art. 32 AVG)**: versleuteling en pseudonimisering van
  bijzondere persoonsgegevens (gezondheidsgegevens, art. 9 AVG) worden in art. 32 expliciet
  genoemd als passende maatregelen. Deze inrichting geeft daar concreet invulling aan.
- **Datalek-impact wordt kleiner**: bij een database-zijdig incident zijn de medische
  gegevens niet (direct) tot personen herleidbaar en zijn de identificerende gegevens
  onleesbaar. Dat is relevant voor de beoordeling en melding van een eventueel datalek.
- **Anonimiseren wordt één handeling**: is een traject afgerond en de bewaartermijn
  verstreken, dan volstaat het verwijderen van één kluisregel. Het medische spoor blijft
  naamloos bestaan voor statistiek — conform dataminimalisatie. Het bijbehorende
  retentiebeleid is als vervolgstap gepland.
- **Dataminimalisatie richting het laboratorium**: het lab ontvangt al langer alleen een
  pseudoniem, geboortedatum en geslacht — nooit een naam.
- **Auditlog blijft onverminderd werken**: de bestaande medische auditlog (wie keek
  wanneer naar welk dossier, met externe kopie) is onaangetast.
- **Sleutelbeheer is belegd**: de sleutel bestaat op twee plekken (server-omgeving +
  wachtwoordkluis), rotatie is technisch voorbereid, en verlies-scenario's staan in het
  implementatieplan beschreven.

## 5. Waar staan we nu?

De verbouwing is stapsgewijs uitgevoerd, zonder onderbreking voor klanten of medewerkers.
Op dit moment wordt nog "dubbel" geschreven (oude én nieuwe plek), zodat elke stap
omkeerbaar is. Zodra de laatste controle op productie is afgerond, worden de oude,
onversleutelde velden definitief verwijderd — vanaf dat moment is een databasediefstal
daadwerkelijk naamloos. Die laatste stap gebeurt gecontroleerd: met een verse backup en
een expliciete go.

---

_Technische uitwerking: `pii-kluis-implementatieplan-v1.0` (dit dossier). Flankerende
servermaatregelen: `server-hardening-checklist-v1.0` (dit dossier)._
