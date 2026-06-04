# Vita Health Platform — Deployment Guide

Complete instructies voor het deployen van Vita Health naar productie via Coolify.

---

## Vereisten

### Lokale vereisten (ontwikkelaars)
- Node.js 22+ (LTS)
- Git
- Docker (voor lokale testing)
- `npm ci` (niet `npm install`)

### Supabase (database & auth)
- Actief Supabase project op `qjchkjpqlxhfdypbiwqc.supabase.co`
- Alle migraties uitgevoerd (zie hieronder)
- Service Role Key bewaard in veilige omgeving

### Coolify (hosting)
- Coolify server >= 4.0 op Debian/Ubuntu
- Docker en Docker Compose actief
- SSH-toegang tot server
- GitHub token voor automatische pulls

### E-mail
- Resend account met geverifieerd domain (`helpdesk.vita-health.nl`)
- Resend API key opgeslagen

### Externe services
- Better Stack account (optioneel, maar aanbevolen)
- Better Stack Source Token voor log drain

---

## Stap 1: Supabase-migraties uitvoeren

Alle migraties staan in `supabase/migrations/001-025.sql`.

**In Supabase SQL Editor:**
1. Ga naar je project → SQL Editor
2. Maak een nieuw query aan
3. Copy-paste de migratiebestanden één voor één in volgorde (001, 002, ... 025)
4. Voer uit met Ctrl+Enter

**Checklist migraties:**
- ✅ 001-010: Base schema (tables, RLS)
- ✅ 011-015: Auth & enrollment
- ✅ 016-022: Auditing & callbacks
- ✅ 023-025: Alerts & log drain

Als een migratie faalt, check de error — meestal constraints of duplicates.

---

## Stap 2: Environment variables instellen

### In Coolify Dashboard

**Environment variables** (rechts bij application):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://qjchkjpqlxhfdypbiwqc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key-from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# URLs
NEXT_PUBLIC_APP_URL=https://platform.vita-health.nl
NEXT_PUBLIC_PORTAL_URL=https://ikwilgraageentest.vita-health.nl

# E-mail
RESEND_API_KEY=re_xxxxxxxxxxxxx
FROM_EMAIL=noreply@helpdesk.vita-health.nl

# Audit & Security
AUDIT_HASH_SALT=<generate-with-openssl-rand-hex-32>
CRON_SECRET=<generate-with-openssl-rand-hex-32>

# Log drain (optioneel)
BETTERSTACK_SOURCE_TOKEN=<optional-better-stack-token>
```

**Hoe secrets genereren:**
```bash
openssl rand -hex 32
```

---

## Stap 3: GitHub integratie in Coolify

1. **Settings** → **GitHub**
2. Maak een **Fine-grained Personal Access Token** aan op GitHub:
   - Ga naar GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Permissions: `contents:read` (repo access)
   - Klik "Generate"
3. Plak token in Coolify
4. Test de verbinding

---

## Stap 4: Docker build configuratie

De app gebruikt een custom **multi-stage Dockerfile** (zie `Dockerfile` in root):

- **Stage 1 (deps)**: Dependencies cachen
- **Stage 2 (builder)**: Compilatie en TypeScript check
- **Stage 3 (runner)**: Slim production image

**Belangrijk:** TypeScript strict mode MOET slagen. Als build faalt:
1. Check de TypeScript-error in logs
2. Fix lokaal met `npm run build`
3. Push fix naar main
4. Coolify zal automatisch redeploy proberen

---

## Stap 5: Port & networking

Coolify exposeert de app standaard op **poort 3000**.

- Nginx reverse proxy moet naar `http://localhost:3000` forwarderen
- Zet `NEXT_PUBLIC_APP_URL` en `NEXT_PUBLIC_PORTAL_URL` naar je echte domains
- SSL/TLS moet in Nginx zitten (niet in Node)

---

## Stap 6: Cron jobs instellen (scheduled tasks)

Voor de auditlog-alerts elke 15 minuten:

### In Coolify Scheduled Tasks

```
Frequency: */15 * * * *

Command: 
curl -s -H "x-cron-secret: <jouw-CRON_SECRET>" \
  https://platform.vita-health.nl/api/cron/audit-checks
```

Zorg dat `CRON_SECRET` exact overeenkomt met wat in environment variables staat.

---

## Stap 7: Deploy starten

1. **Coolify Dashboard** → je app → **Deploy**
2. Wacht op build (±30-40 seconden)
3. Check logs voor errors

### Veelvoorkomende build-errors

**Error: "Cannot invoke an object which is possibly 'undefined'"**
- TypeScript strict mode issue
- Fix: Zorg dat alle `createAdminClient()` calls hebben expliciete return type
- Pull latest main en redeploy

**Error: "Service key not found"**
- `SUPABASE_SERVICE_ROLE_KEY` staat niet in environment variables
- Fix: Zet hem in Coolify Settings

**Error: "Build cache not cleared"**
- Docker cache bevat oude artefacten
- Fix: In Coolify → Settings → **Clear Build Cache** → redeploy

---

## Stap 8: Database backups

### Supabase backup-instellingen

1. Ga naar je Supabase project → Settings → Backups
2. Zet Point-in-Time Recovery (PITR) aan (Pro plan)
3. Zet dagelijkse backups aan

### Local backup (handmatig)

```bash
# Export database dump
pg_dump -h db.qjchkjpqlxhfdypbiwqc.supabase.co \
  -U postgres -d postgres > backup_$(date +%Y%m%d).sql
```

---

## Stap 9: Verificatie na deploy

Na succesvol deploy checken:

### 1. Portaalpagina's
- [ ] https://ikwilgraageentest.vita-health.nl/ laadt
- [ ] Intake-formulier responsive
- [ ] Toestemmingen zichtbaar

### 2. Dashboard
- [ ] https://platform.vita-health.nl/ vraagt login
- [ ] 2FA verplicht
- [ ] Cliëntenlijst laadt
- [ ] Auditlog (/auditlog) alleen voor admin zichtbaar

### 3. Database
- [ ] Login probeert (check logs voor rate-limiting)
- [ ] Intake versturen werkt

### 4. E-mail
- [ ] Test: nieuw account aanmaken
- [ ] Bevestigings-e-mail moet arriveren

### 5. Auditlog
- [ ] Cliëntdossier inzien → verschijnt in auditlog
- [ ] Export → audit-event met `outcome: success`

---

## Troubleshooting

### Deploy hangt vast
```
Symptoom: "Building for 60+ seconds"
Oorzaak: Grote Docker build cache of slow network
Oplossing: In Coolify → Clear Build Cache
```

### TypeScript errors na push
```
Symptoom: "Failed to type check"
Oorzaak: Strict mode catching issues
Fix stappen:
1. git clone lokaal
2. npm ci
3. npm run build (reproduce error)
4. Fix de issue
5. git push
6. Coolify redeploy
```

### Supabase migratie faalt
```
Symptoom: "Relation already exists" of "FK constraint error"
Oplossing:
1. Check welke migratie faalt
2. Verwijder de faalde query
3. Fix constraint issues
4. Run opnieuw
```

### E-mails worden niet verzonden
```
Stap 1: Check RESEND_API_KEY in Coolify
Stap 2: Check FROM_EMAIL is geverifieerd in Resend
Stap 3: Check server logs: docker logs <container-id>
Stap 4: Test: curl https://resend.com/api/emails (controleer auth)
```

---

## Rollback procedure

Als iets misgaat na deploy:

**Terug naar vorige versie:**
1. In Coolify → go to **Releases**
2. Click versie-1 → **Restore**
3. Server reboots automatisch

**Git rollback (als je code-push naar main hebt):**
```bash
git revert <commit-sha>  # Creates new commit
git push origin main
# Coolify detects new commit en redeploy
```

**NOOIT doen:**
```bash
git reset --hard <old-commit>  # Zal conflicts creëren
git push --force  # Verbreekt Git history
```

---

## Monitoring & Alerts

### Logs controleren
- Coolify → Application → **Logs** (live tail)
- Better Stack (als geconfigureerd) voor externe logs

### Alert checken
- Dashboard → top van pagina banner met openstaande alerts
- /auditlog → volledig alertenoverzicht

### Status monitor
- Zet monitoring in voor `/api/health` endpoint (als gemaakt)
- Of monitor `https://platform.vita-health.nl` externe ping

---

## Security best practices post-deploy

✅ **Checklist:**
- [ ] 2FA afdwingen voor alle medewerkers
- [ ] Service Role Key NOOIT in logs/console
- [ ] `BETTERSTACK_SOURCE_TOKEN` ingesteld (tamper-resistance)
- [ ] Cron job draait elke 15 min (audit alerts)
- [ ] HTTPS-only (geen HTTP fallback)
- [ ] Supabase RLS enabled op alle gevoelige tabellen
- [ ] Database backups actief
- [ ] DPIA en Verwerkersovereenkomst ondertekend

---

## Automatische redeploy

Coolify kijkt naar je GitHub-repo. Bij push naar `main`:
1. GitHub webhook triggered
2. Coolify detecteert nieuwe commit
3. Build start automatisch
4. Geen handmatige redeploy nodig

**Als Coolify niet redeploy na push:**
- Check GitHub token geldig
- Check webhook URL in GitHub settings
- Coolify → Application → **Manual webhook test**

---

## Contact & Support

- **Supabase docs:** https://supabase.com/docs
- **Next.js docs:** https://nextjs.org/docs
- **Coolify docs:** https://coolify.io/docs

---

*Gemaakt voor Vita Health — Biomarker Platform*  
*Laatst bijgewerkt: 2026-06-04*
