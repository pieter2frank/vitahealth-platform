# PII-kluis — gefaseerd implementatieplan

_Scheiding van herleidbare persoonsgegevens en medische gegevens (optie D: tabelsplitsing + kolomversleuteling)_

| | |
|---|---|
| **Versie** | 1.1 |
| **Datum** | 13 augustus 2026 |
| **Wijzigingen v1.1** | Status bijgewerkt: fasen 0–3 afgerond en geverifieerd op productie. |
| **Status** | Fasen 0–3 afgerond (13 augustus 2026); fase 4 gepland |
| **Eigenaar** | Vita Health |
| **Rollback-anker** | git-tag `pre-pii-kluis` (commit `80923c3`) |

> Markdown-versie van `docs/pii-kluis-implementatieplan-v1.1.docx`. Bij een inhoudelijke
> wijziging: nieuw bestand met opgehoogd versienummer; oude versies blijven als historie.

---

## 0. Uitvoeringsstatus (v1.1)

| Fase | Status |
|---|---|
| 0 — Fundament (crypto, toegangslaag, migratie 077) | ✅ Afgerond |
| 1 — Dubbelschrijven + backfill (29/29 geverifieerd) | ✅ Afgerond |
| 2 — Alle leesflows via de kluis (migratie 078) | ✅ Afgerond |
| 3 — PII-kolommen gedropt (migraties 079 + 080) | ✅ Afgerond — slotcontrole bevestigd: vh_client bevat alleen nog `id`, `subject_ref`, `gender`, `enrollment_status`, `created_at` |
| 4 — Rotatieprocedure, retentie/anonimisering, audit bij bulk-ontsleuteling | ◻ Gepland |
| 5 — Optioneel: `vh_order.buyer_*`, aanvraag-PII, notitie-beleid | ◻ Optioneel |

Sinds 13 augustus 2026 bestaan naam, adres, e-mail, telefoon en geboortedatum uitsluitend
versleuteld in de kluis; een databasedump is naamloos. Het point of no return (migratie 080)
is gepasseerd — herstel van vóór dat moment kan alleen nog via een databasebackup.

---

## 1. Doel en dreigingsmodel

Herleidbare persoonsgegevens (naam, adres, e-mail, telefoon, geboortedatum) worden
gescheiden van de medische gegevens (uitslagen, vragenlijsten, adviezen) opgeslagen in een
aparte, **versleutelde identiteitskluis**. De versleutelingssleutel staat buiten de database.

Wat dit oplevert per aanvalsscenario:

| Scenario | Zonder kluis | Met kluis |
|---|---|---|
| Gestolen database-dump/backup | volledige dossiers met naam | naamloze dossiers + onleesbare kluis |
| Gelekte database-credentials / SQL-injectie | idem | idem |
| Gelekte `service_role`-sleutel | alles leesbaar | medisch spoor leesbaar, identiteiten niet (sleutel ontbreekt) |
| Te ruime interne toegang | mogelijk | kluis alleen via `service_role` + app-sleutel |
| Volledig gecompromitteerde appserver | alles | alles — hiertegen beschermen de bestaande maatregelen (2FA, CSP, auditing) |

## 2. Eindbeeld

```
vh_client (dossier — pseudoniem)          vh_client_identity (kluis — versleuteld)
├─ id (blijft de FK voor alles)           ├─ client_id  (PK, FK → vh_client, cascade)
├─ subject_ref                            ├─ first_name_enc   ── AES-256-GCM
├─ gender                                 ├─ last_name_enc
├─ enrollment_status                      ├─ email_enc / phone_enc / birth_date_enc
└─ created_at                             ├─ address_enc / postal_code_enc / city_enc
                                          ├─ email_hash  (HMAC, voor lookups)
vh_report / vh_questionnaire_response /   └─ created_at / updated_at
vh_advice / vh_testkit → wijzen naar
vh_client.id — ONGEWIJZIGD
```

**Cryptografie**

- Per veld AES-256-GCM met een willekeurige nonce en versieprefix (`v1:…`) voor sleutelrotatie.
- AAD (additional authenticated data) = `client_id:veldnaam`, zodat ciphertext niet tussen
  rijen of velden verwisseld kan worden.
- `email_hash` = HMAC-SHA256 over het genormaliseerde e-mailadres (lowercase, trimmed) —
  vervangt de `ilike`-lookups zonder het adres leesbaar op te slaan.
- Sleutels: `PII_ENCRYPTION_KEY` en `PII_HASH_KEY` (elk 32 bytes, base64) — uitsluitend in de
  server-omgeving (Coolify), nooit in de database, git of `NEXT_PUBLIC_*`.

**Toegang**

- `vh_client_identity`: RLS aan zonder policies + `revoke all` voor `anon` en `authenticated`
  → alleen `service_role` kan erbij, en alleen de app kan ontsleutelen. Dubbel slot.
- Alle toegang loopt via één toegangslaag: `lib/pii/identity.ts` (server-only).

**Bijeffect**: anonimiseren van een afgerond dossier = één rij uit de kluis verwijderen; het
medische spoor blijft naamloos bestaan voor statistiek.

## 3. Fasering

### Fase 0 — Fundament (additief, geen gedragswijziging)

1. Sleutels genereren; in Coolify en `.env.local` zetten.
2. `lib/pii/crypto.ts`: `encryptField`/`decryptField` (AES-256-GCM + AAD + versieprefix) en
   `emailHash()`; geverifieerd met round-trip-, tamper- en stabiliteitstests.
3. `lib/pii/identity.ts`: `getIdentity`, `getIdentities` (batch), `findClientIdByEmail`,
   `upsertIdentity`.
4. Migratie 077: kluis-tabel + grants dichtzetten (tabel blijft leeg).

**Rollback**: triviaal — niets gebruikt de kluis nog.

### Fase 1 — Dubbelschrijven + backfill (oude kolommen blijven leidend)

1. Alle PII-schrijfpaden vullen beide kanten: oude kolommen én kluis. Schrijfplekken:
   `settleOrderPaid`, cliënt-bewerken (admin), uitnodigen-flow, portal-personalia-stap.
2. Portal-personalia verhuist van de browser-RPC (`portal_register_client`) naar een server
   route die versleutelt en schrijft — dit is meteen de geparkeerde P1-3-refactor voor deze stap.
3. Eenmalige backfill: bestaande cliënten versleuteld naar de kluis + `email_hash`.

**Verificatie**: kluisrij aanwezig én ontsleutelbaar voor elke cliënt; counts gelijk.
**Rollback**: kluis negeren; oude kolommen zijn intact.

### Fase 2 — Leesflows omzetten (per spoor deploybaar)

| Spoor | Wijziging |
|---|---|
| 2a Portal/intake | `resolve_intake_token` en `get_enrollment_status_by_token` geven `client_id`/ciphertext i.p.v. klare PII; de server components ontsleutelen via de toegangslaag. |
| 2b Betaalmuur | `fulfil.ts` en `resume-link` zoeken via `email_hash`; factuur/e-mail halen naam via de toegangslaag. |
| 2c Admin-UI | Cliëntenlijst, aanvragen, testkits, dossier: batch-ophalen via `getIdentities()` na de bestaande rolcheck; naam-zoeken in de app-laag. |
| 2d Exports/e-mail | Batch-export (geboortedatum/geslacht), secure delivery en e-mailtemplates lezen via de toegangslaag (alles is al server-side). |

**Rollback per spoor**: terugvallen op de oude kolommen.

### Fase 3 — Scheiding afdwingen (point of no return)

1. Controle dat geen codepath de oude kolommen nog leest (grep + regressieronde op de
   testomgeving).
2. Migratie 078: PII-kolommen droppen uit `vh_client`; RPC's en audit-triggers bijwerken.
3. `types/index.ts`: `Client` wordt pseudoniem; identiteit apart type.

Vanaf hier is een databasedump naamloos. Uitvoeren ná een volledige regressieronde;
voorafgaand een database-backup nemen.

### Fase 4 — Flankerend

- Sleutelrotatieprocedure (nieuwe sleutel als `v2:`, lazy her-encryptie, batch-job).
- Retentiebeleid: afgerond traject + verstreken termijn → kluisrij wissen = geanonimiseerd.
- Auditlog-event bij bulk-ontsleuteling (exports) — centraal in de toegangslaag.
- Beveiligingsdocumentatie bijwerken (nieuwe versie beveiligingsmaatregelen-document).

### Fase 5 — Optioneel, later

- `vh_order.buyer_*` + order-e-mail: financiële administratie met eigen grondslag
  (factuurplicht); desgewenst later versleutelen met dezelfde helper.
- Beleid vrije-tekstvelden (`vh_client_note`): geen herleidbare gegevens in vrije tekst.

## 4. Rollback-strategie

- **Codebuild**: git-tag `pre-pii-kluis` markeert de laatste build vóór dit traject; elke
  fase is een losse commit — terugrollen = eerdere commit deployen.
- **Database**: fases 0–2 zijn puur additief (nieuwe tabel, nieuwe kolomschrijfacties); een
  oudere build blijft er gewoon naast draaien. Het enige destructieve moment is fase 3
  (kolommen droppen) — daarvóór: backup + expliciete go/no-go.
- **Sleutels**: verlies van `PII_ENCRYPTION_KEY` = verlies van de identiteiten. De sleutel
  wordt daarom bij aanmaak op een tweede veilige plek bewaard (wachtwoordmanager).

## 5. Inschatting

| Fase | Omvang | Risico |
|---|---|---|
| 0 | klein | geen |
| 1 | middel | laag (additief) |
| 2 | grootste deel (~57 bestanden, grotendeels mechanisch) | laag per spoor |
| 3 | klein maar definitief | gecontroleerd moment |
| 4 | klein | geen |
