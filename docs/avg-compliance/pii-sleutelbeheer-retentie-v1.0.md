# PII-kluis — sleutelbeheer- en retentieprocedure

_Sleutelrotatie, verlies-scenario's en het anonimiseren van dossiers (fase 4)_

| | |
|---|---|
| **Versie** | 1.0 |
| **Datum** | 13 augustus 2026 |
| **Status** | Vastgesteld |
| **Eigenaar** | Vita Health |
| **Zusterdocumenten** | `pii-kluis-implementatieplan-v1.1`, `pii-kluis-toelichting-avg-v1.1` |

> Markdown-versie van `docs/pii-sleutelbeheer-retentie-v1.0.docx`.

---

## 1. Sleutelinventaris

| Sleutel | Doel | Opslaglocaties |
|---|---|---|
| `PII_ENCRYPTION_KEY` (= versie 1) | Veldversleuteling van de kluis (AES-256-GCM) | Coolify-omgeving + wachtwoordmanager |
| `PII_ENCRYPTION_KEY_V2`, `_V3`, … | Opvolgers na rotatie | idem |
| `PII_HASH_KEY` | E-mail-vingerafdruk (`email_hash`) voor lookups | idem |

Regels:

- Elke sleutel staat op **precies twee plekken**: de server-omgeving (Coolify) en de
  wachtwoordmanager. Nooit in git, buildlogs, scripts, e-mail of chat.
- Ontwikkelomgeving en productie delen één database en dus **één sleutelset**.
- **Verlies van alle kopieën van een versleutelsleutel = definitief verlies van de
  identiteiten** die ermee versleuteld zijn. De wachtwoordmanager-kopie is daarom net zo
  belangrijk als de server-kopie.
- `PII_HASH_KEY` wordt niet geroteerd (rotatie zou alle e-mail-lookups breken); bij
  compromittering: zie hoofdstuk 4.

## 2. Sleutelrotatie (procedure)

De kluis ondersteunt meerdere sleutelversies naast elkaar: elk veld draagt een
versieprefix (`v1:`, `v2:`, …), nieuwe versleutelingen gebruiken automatisch de hoogste
aanwezige versie, en ontsleutelen kiest per veld de juiste sleutel. Roteren is daardoor
zonder onderbreking mogelijk.

**Wanneer roteren**: bij (vermoeden van) compromittering, bij vertrek van iemand met
toegang tot de sleutels, of periodiek (aanbeveling: jaarlijks).

**Stappen**:

1. Genereer een nieuwe sleutel:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
2. Zet hem in Coolify als **`PII_ENCRYPTION_KEY_V2`** (of V3, V4, … — altijd één hoger
   dan de hoogste bestaande) en **laat de oude sleutel(s) staan**. Sla de nieuwe sleutel
   ook op in de wachtwoordmanager. Redeploy.
3. Log in als admin en open **`/api/admin/pii-rotate`**. Alle kluisrijen worden
   herversleuteld naar de nieuwste versie; de respons toont `geroteerd`, `alActueel` en
   eventuele `failures`. De run is idempotent en mag herhaald worden.
4. Controleer dat de respons `ok: true` en `remaining: 0` meldt.
5. **Pas daarna** de oude sleutel verwijderen: uit Coolify (redeploy) én, na een
   bewaarperiode van bijv. één maand, uit de wachtwoordmanager.
6. Noteer de rotatie (datum, aanleiding, uitvoerder) in het beveiligingsdossier. De run
   zelf staat ook in de auditlog (`PII-sleutelrotatie-run`).

⚠️ Verwijder een oude sleutel **nooit** vóór stap 4 is bevestigd: velden die nog op de
oude versie staan, zijn anders onleesbaar.

## 3. Retentie en anonimiseren

**Principe**: is een traject afgerond en de bewaartermijn verstreken, dan wordt het
dossier geanonimiseerd. De medische gegevens blijven naamloos bestaan (statistiek); de
identiteit verdwijnt definitief.

**Hoe**: op de dossierpagina staat voor admins de knop **"Dossier anonimiseren"** —
alleen beschikbaar bij een afgerond of beëindigd traject (uitslag besproken, intake
afgewezen of geannuleerd). De actie:

1. verwijdert de kluisrij (naam, adres, e-mail, telefoon, geboortedatum — onomkeerbaar);
2. wist de kopergegevens op de bestellingen van deze cliënt, zodat het dossier ook via de
   betaal-administratie niet herleidbaar is;
3. schrijft een verplichte auditregel (zonder audit geen anonimisering).

**Wat bewust blijft**: de formele factuur-PDF's in de afgeschermde facturenbucket. Die
vallen onder de fiscale bewaarplicht (7 jaar) met een eigen grondslag, en zijn niet
gekoppeld aan het medische dossier.

**Termijnen**: de concrete bewaartermijnen per gegevenscategorie volgen het
retentiebeleid in het compliance-dossier; deze procedure beschrijft het mechanisme.

## 4. Verlies- en compromitteringsscenario's

| Scenario | Actie |
|---|---|
| Versleutelsleutel gelekt (vermoeden) | Direct roteren (hoofdstuk 2). De oude sleutel pas verwijderen na een geslaagde rotatie-run. |
| `PII_HASH_KEY` gelekt | Impact beperkt (alleen e-mail-vingerafdrukken; niet omkeerbaar naar adressen zonder woordenboekaanval). Vervangen kan door een nieuwe hash-sleutel te zetten en de `email_hash`-kolom opnieuw te laten vullen via een eenmalige herindexering. |
| Server-omgeving kwijt (Coolify-herinstallatie) | Sleutels terugzetten uit de wachtwoordmanager. |
| Wachtwoordmanager-kopie kwijt | Direct een nieuwe kopie maken vanuit de Coolify-omgeving — er mag nooit één opslagplek overblijven. |
| **Alle kopieën van een sleutel kwijt** | De met die versie versleutelde identiteiten zijn definitief onleesbaar. Herstel alleen via een databasebackup van vóór het verlies + de destijds geldige sleutel. Dit scenario is de reden voor de twee-plekken-regel. |

## 5. Audit bij bulk-ontsleuteling

Reguliere schermweergaven (lijsten, dossiers) vallen onder de bestaande toegangs- en
auditregels van het platform. Voor **bulk-ontsleuteling** geldt extra vastlegging:

- De Nightingale-batchexport logt per export het aantal ontsleutelde identiteiten
  (`identities_decrypted`) in de bestaande, blokkerende auditregel.
- De sleutelrotatie-run logt zichzelf (aantallen, doelversie, uitvoerder).
- De anonimiseer-actie logt blokkerend (zie hoofdstuk 3).

## 6. Periodieke controle (kwartaalritueel)

- [ ] Staan alle sleutels nog op precies twee plekken (Coolify + wachtwoordmanager)?
- [ ] Is de jongste rotatie < 12 maanden geleden (of is er een gedocumenteerde reden)?
- [ ] Zijn er dossiers die volgens het retentiebeleid geanonimiseerd moeten worden?
- [ ] Steekproef auditlog: staan export- en anonimiseer-acties er correct in?
