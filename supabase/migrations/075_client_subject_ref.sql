-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 075: pseudoniem per cliënt (subject_ref)
--
-- Een stabiel, pseudoniem persoon-ID dat we meesturen in de Nightingale-export
-- ("Subject ID"). Hiermee kan Nightingale bepalen of iemand een eerdere test
-- heeft gehad en metingen over de tijd vergelijken, zónder dat wij naam of andere
-- identificerende gegevens hoeven mee te sturen.
--
-- Het pseudoniem is bewust losgekoppeld van de primary key (vh_client.id): zo kan
-- een toekomstige "tweede test op dezelfde naam"-flow, of het samenvoegen van
-- dubbele cliëntrecords, twee rijen naar hetzelfde subject_ref laten wijzen zonder
-- foreign keys te raken.
--
-- De `default gen_random_uuid()` zorgt ervoor dat ALLE bestaande cliënten (ook wie
-- al een meting heeft gehad) met terugwerkende kracht direct een uniek pseudoniem
-- krijgen op het moment dat de kolom wordt toegevoegd.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_client
  add column if not exists subject_ref uuid not null default gen_random_uuid();

-- Uniek per cliënt (dubbele waarden voorkomen; index voor snelle lookups).
create unique index if not exists vh_client_subject_ref_key on vh_client (subject_ref);

comment on column vh_client.subject_ref is
  'Pseudoniem persoon-ID voor externe labkoppeling (Nightingale "Subject ID"). Stabiel, geen PII.';
