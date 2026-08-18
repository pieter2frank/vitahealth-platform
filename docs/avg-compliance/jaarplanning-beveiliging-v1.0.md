# Jaarplanning beveiliging & controles

_Terugkerende beveiligingstaken, augustus 2026 – augustus 2027_

| | |
|---|---|
| **Versie** | 1.0 |
| **Datum** | 18 augustus 2026 |
| **Status** | Vastgesteld — als agenda-items ingepland (iCal) |
| **Eigenaar** | Vita Health |

> De bijbehorende agenda-afspraken staan in `13-agenda planning/vita-health-beveiligingsplanning.ics`
> (geïmporteerd in de agenda van de beheerder). Inhoudelijke procedures staan in
> `server-hardening-checklist-v1.0` en `pii-sleutelbeheer-retentie-v1.0`.

---

## 1. Het ritme in één oogopslag

| Frequentie | Wat | Duur | Eerstvolgende |
|---|---|---|---|
| **Maandelijks** (1e maandag) | Serveronderhoud: updates + reboot-check beide servers, Coolify-update, fail2ban-blik | ±15 min | 7 sep 2026 |
| **Per kwartaal** | Kwartaalritueel: sleutels, retentie, auditlog, firewall, toegang | ±30 min | 17 nov 2026 |
| **Halfjaarlijks** | Backup-restoretest (incl. sleutel-op-backup-test) | ±45 min | 23 feb 2027 |
| **Jaarlijks** | Grote beveiligingsreview incl. PII-sleutelrotatie, toegangs- en documentenreview | ±90 min | 17 aug 2027 |

De kwartaalritmes vallen in november, februari en mei; het augustus-kwartaal gaat op in de
jaarlijkse review.

## 2. Maandelijks serveronderhoud (±15 min)

Beide servers (control-plane `149.210.173.248`, app-server `149.210.237.67`):

1. `sudo apt update && sudo apt upgrade -y`
2. Bij "*** System restart required ***": reboot uitvoeren of bewust plannen
   (app-server = platform ±2 min offline; control-plane = alleen het Coolify-paneel).
3. Coolify: Settings → Update.
4. `sudo fail2ban-client status sshd` — draait hij, zijn er opvallende bans?

## 3. Kwartaalritueel (±30 min) — nov / feb / mei

1. **Sleutels**: `PII_ENCRYPTION_KEY(_Vn)` + `PII_HASH_KEY` op precies twee plekken
   (Coolify + wachtwoordmanager)?
2. **Rotatie**: jongste PII-sleutelrotatie < 12 maanden?
3. **Retentie**: dossiers met afgerond/beëindigd traject en verstreken bewaartermijn →
   "Dossier anonimiseren".
4. **Auditlog-steekproef**: export- en anonimiseer-regels aanwezig en kloppend?
5. **Firewallregels** (TransIP, beide servers) nog conform de checklist?
6. **authorized_keys** beide servers: alleen de eigen sleutel (+ coolify-sleutel op de
   app-server).
7. **Coolify**: accounts/tokens nalopen, 2FA actief.

## 4. Backup-restoretest (±45 min) — februari

1. Controleer dat de automatische Supabase-backups draaien.
2. Voer een testrestore uit (tijdelijk project), of minimaal: download een backup en
   controleer leesbaarheid/compleetheid.
3. **Cruciaal**: controleer dat de PII-sleutels uit de wachtwoordmanager de kluisvelden in
   die backup ontsleutelen — een backup zonder werkende sleutel is onbruikbaar.
4. Datum + uitkomst noteren in het beveiligingsdossier.

## 5. Jaarlijkse beveiligingsreview (±90 min) — augustus

1. Volledig kwartaalritueel (hoofdstuk 3).
2. **PII-sleutelrotatie** volgens procedure (`pii-sleutelbeheer-retentie-v1.0`, h2):
   nieuwe `PII_ENCRYPTION_KEY_V<n+1>` → redeploy → `/api/admin/pii-rotate` → pas bij
   `remaining: 0` de oude sleutel verwijderen.
3. Overige sleutels roteren of beoordelen: Mollie, Zivver, Resend,
   `SUPABASE_SERVICE_ROLE_KEY`, `AUDIT_HASH_SALT`.
4. **Toegangsreview**: wie heeft toegang tot Coolify, Supabase, TransIP, GitHub en de
   wachtwoordmanager? Vertrokken personen → sleutels roteren.
5. Backup-restoretest herhalen (hoofdstuk 4).
6. **Documentenreview**: kloppen de versies in `docs/` nog met de werkelijkheid?
7. **Verwerkersovereenkomsten** actueel (Supabase, Mollie, Zivver, Resend, Better Stack,
   hosting)?
8. Server-hardening-checklist volledig opnieuw aflopen op beide servers.

## 6. Vastlegging

Elke uitgevoerde controle kort noteren (datum, uitvoerder, bijzonderheden) — dat is meteen
het bewijs van "aantoonbare controle" richting de AVG-functionaris. Een regel per keer in
een logboekbestand of in dit dossier volstaat.
