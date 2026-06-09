@AGENTS.md

# Vita Health Platform

Next.js 16 applicatie voor biomarker testkit logistiek.

## Tech stack
- Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- Supabase (zelfde instance als helpdesk): qjchkjpqlxhfdypbiwqc.supabase.co
- Lucide React, date-fns (nl locale), react-hook-form + zod

## Domeinen
- platform.vita-health.nl → medewerkers portaal (achter login)
- ikwilgraageentest.vita-health.nl → klantportaal (toekomstig)

## Tabel prefix
Alle Supabase tabellen beginnen met `vh_`: vh_testkit, vh_client, vh_arbo, vh_company

## Testkit statusflow
received → assigned → retour → sent_nightingale → results_available

## Stijl
Identiek aan helpdesk (C:\Data\apps\helpdesk). Brand colors in globals.css.
Primary: #1f1683, Accent: #17e4a1

## Dev
```
npm run dev   # http://localhost:3000
```

## Database migraties
Staan in supabase/migrations/. Uitvoeren via Supabase SQL Editor.

## Documentversiebeheer (docs/)
Beleidsdocumenten in `docs/` dragen een versienummer in de bestandsnaam,
bijv. `beveiligingsmaatregelen-vita-health-v1.0.docx`. Bij elke inhoudelijke
wijziging: een NIEUW bestand met opgehoogd versienummer aanmaken (oude versies
laten staan als historie) en het versienummer ook op de cover bijwerken.
Patch/kleine wijziging → minor ophogen (v1.0 → v1.1); grote herziening → major
(v1.x → v2.0).
