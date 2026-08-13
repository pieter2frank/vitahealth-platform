# Server-hardening checklist — Vita Health

_Beveiliging van de twee TransIP-VPS'en en het Coolify-paneel (flankerend bij de PII-kluis)_

| | |
|---|---|
| **Versie** | 1.0 |
| **Datum** | 13 augustus 2026 |
| **Status** | Vastgesteld — af te lopen per server |
| **Eigenaar** | Vita Health |

> Markdown-versie van `docs/server-hardening-checklist-v1.0.docx`. Context: op deze servers
> staan de omgevingssleutels (`SUPABASE_SERVICE_ROLE_KEY`, en met de PII-kluis ook
> `PII_ENCRYPTION_KEY`/`PII_HASH_KEY`). Wie deze servers overneemt, heeft alles — daarom is
> dit de belangrijkste verdedigingslinie. Zie ook `pii-kluis-implementatieplan-v1.0`.

---

## 0. Topologie (ter referentie)

| Server | Rol | Egress-IP |
|---|---|---|
| Control-plane | Draait alleen Coolify (paneel + deploys) | `149.210.173.248` |
| App-server (`zorgnl@cloud`) | Draait de vitahealth-container | `149.210.237.67` |

Belangrijk om te weten:
- De **TransIP VPS-firewall** (in het TransIP-klantenpaneel) filtert **inkomend** verkeer en
  zit vóór de server. Wijzigingen doe je altijd vanuit het TransIP-paneel — je kunt jezelf
  er dus nooit definitief mee buitensluiten.
- `ufw` op de host is **onbetrouwbaar voor Docker-poorten**: Docker schrijft eigen
  iptables-regels die ufw omzeilen. Gepubliceerde containerpoorten blijven bereikbaar, ook
  als ufw "deny" zegt. Daarom is de TransIP-firewall de juiste plek voor poortregels.
- Coolify (control-plane) beheert de app-server via **SSH**: de app-server moet inkomend
  SSH toestaan vanaf `149.210.173.248`, anders breken deploys.

## 1. Coolify-paneel (control-plane)

- [ ] **2FA inschakelen** op het Coolify-account (Profile → Two-factor Authentication).
- [ ] **Sterk, uniek wachtwoord** (wachtwoordmanager); registratie van nieuwe accounts uit
      (Settings → Registration disabled).
- [ ] **Geen slapende teamleden of API-tokens**: Keys & Tokens nalopen; alles wat niet
      actief gebruikt wordt verwijderen.
- [ ] **Coolify up-to-date houden**: maandelijkse check op updates (Settings → Update).
      Oudere versies hebben bekende kwetsbaarheden gehad.
- [ ] **Paneel niet publiek bereikbaar** — zie hoofdstuk 2 (dit regel je bij TransIP, niet
      in Coolify).

## 2. TransIP VPS-firewall — paneel afschermen (de allowlist)

**Waar**: TransIP-klantenpaneel → VPS → (server kiezen) → Firewall. **Niet** in Coolify
(daar bestaat geen IP-allowlist) en **niet** met ufw (Docker-bypass, zie hoofdstuk 0).

**Voorbereiding**
- [ ] Eigen publieke IP opzoeken (bijv. via icanhazip.com). Let op: verandert je thuis-IP
      wel eens, dan pas je na zo'n wijziging de regel aan via het TransIP-paneel — SSH-nood-
      toegang blijft altijd mogelijk via de VPS-console in het TransIP-paneel.
- [ ] Vaststellen via welke URL/poort je het Coolify-paneel opent:
      `http://149.210.173.248:8000` (standaard) of een eigen domein via 80/443.

**Control-plane (`149.210.173.248`) — inkomende regels**
- [ ] Paneelpoort(en) alleen vanaf eigen IP: poort **8000** (en **6001/6002** als het paneel
      die gebruikt voor realtime/terminal), óf **80/443** als het paneel achter een eigen
      domein draait.
- [ ] **SSH (22)** alleen vanaf eigen IP.
- [ ] Al het overige inkomend verkeer: dicht.
- [ ] **Let op webhooks**: gebruik je automatische deploys bij een git-push (GitHub-webhook
      naar het paneel), dan blokkeert de allowlist die. Kies: handmatig deployen via het
      paneel (simpelst en veiligst), of de webhook-route apart bereikbaar laten.

**App-server (`149.210.237.67`) — inkomende regels**
- [ ] **80/443 open voor iedereen** (hier draait het publieke platform — niet beperken!).
- [ ] **SSH (22)** alleen vanaf: eigen IP **én** `149.210.173.248` (anders breken
      Coolify-deploys).
- [ ] Al het overige inkomend verkeer: dicht.

**Verificatie**
- [ ] Vanaf een ander netwerk (bijv. mobiele hotspot): paneel-URL moet **niet** laden;
      platform-site moet **wél** laden.
- [ ] Deploy draaien vanuit Coolify: moet nog steeds werken (SSH control-plane → app-server).

## 3. SSH-hardening (beide servers)

- [ ] Alleen sleutel-authenticatie; wachtwoordlogin uit. In `/etc/ssh/sshd_config`
      (of een dropin in `sshd_config.d/`):

```
PasswordAuthentication no
PermitRootLogin prohibit-password
KbdInteractiveAuthentication no
```

- [ ] Herladen: `sudo systemctl reload ssh` — en **test in een tweede terminal** dat
      inloggen met je sleutel nog werkt vóór je de eerste sessie sluit.
- [ ] **fail2ban** installeren (vangt brute-force op SSH af):

```
sudo apt install -y fail2ban && sudo systemctl enable --now fail2ban
```

- [ ] Controleren wie er kán inloggen: `ls ~/.ssh/authorized_keys` per account nalopen;
      onbekende sleutels verwijderen.

## 4. Automatische beveiligingsupdates (beide servers)

- [ ] `unattended-upgrades` aan:

```
sudo apt install -y unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades
```

- [ ] Maandelijkse handmatige check: `sudo apt update && sudo apt list --upgradable`
      (kernel/Docker-updates vergen soms een reboot — plan die).

## 5. Secrets-hygiëne

- [ ] Sleutels (`SUPABASE_SERVICE_ROLE_KEY`, `PII_ENCRYPTION_KEY`, `PII_HASH_KEY`, Mollie,
      Zivver, Resend) staan **alleen** in Coolify-env + wachtwoordmanager — nooit in git,
      buildlogs, scripts of shell-history.
- [ ] `PII_ENCRYPTION_KEY` staat óók in de wachtwoordmanager (verlies = identiteiten kwijt).
- [ ] Backups van de Coolify-server bevatten de env-configuratie → zelfde beschermingsniveau
      geven als de server zelf (versleuteld, beperkte toegang).
- [ ] Bij vertrek/wissel van een beheerder: alle sleutels roteren.

## 6. Monitoring en signalering

- [ ] fail2ban-status periodiek bekijken: `sudo fail2ban-client status sshd`.
- [ ] Betrouwbare melding bij paneel-logins: Coolify toont login-activiteit; check bij elke
      verdenking. (Auditlog van de applicatie zelf loopt al extern via Better Stack.)
- [ ] Kwartaalritueel (agenda-item): deze checklist opnieuw aflopen — updates, accounts,
      firewallregels, authorized_keys.

## 7. Bewust NIET gedaan (en waarom)

- **ufw als poortfilter voor het paneel** — Docker omzeilt ufw voor gepubliceerde poorten;
  schijnveiligheid. De TransIP-firewall zit vóór de server en heeft dit probleem niet.
- **Externe KMS/secrets manager** — beschermt niet tegen een overgenomen appserver (de app
  moet runtime kunnen ontsleutelen); wél zinvol als latere opschaalstap voor rotatie en
  audit. Zie pii-kluis-implementatieplan, fase 4/5.
- **Poort-obscurity (SSH verplaatsen)** — optioneel; de allowlist + key-only auth doen het
  echte werk.
