-- Vita Health — Aanmeldprocedure & deelnemersstatus

-- ─── Enrollment status op vh_client ──────────────────────────────────────────
alter table vh_client
  add column enrollment_status text not null default 'aangemeld'
  constraint vh_client_enrollment_status_check check (
    enrollment_status in (
      'aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld',
      'intake_akkoord', 'kit_opgestuurd', 'kit_retour',
      'uitslag_bekend', 'uitslag_besproken'
    )
  );

create index vh_client_enrollment_status_idx on vh_client (enrollment_status);

-- ─── Toestemmingen per cliënt ─────────────────────────────────────────────────
create table vh_consent (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references vh_client(id) on delete cascade,
  required    boolean[] not null,  -- 14 verplichte toestemmingen
  optional    boolean[] not null,  -- 3 optionele toestemmingen
  created_at  timestamptz not null default now()
);

alter table vh_consent enable row level security;

create policy "auth read consent"
  on vh_consent for select to authenticated using (true);

create policy "anon insert consent"
  on vh_consent for insert to anon with check (true);

-- ─── App-instellingen (sleutel-waarde) ────────────────────────────────────────
create table vh_setting (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

alter table vh_setting enable row level security;

create policy "auth read setting"
  on vh_setting for select to authenticated using (true);
create policy "auth upsert setting"
  on vh_setting for insert to authenticated with check (true);
create policy "auth update setting"
  on vh_setting for update to authenticated using (true);

-- Portal mag instellingen lezen (intake vragenlijst id ophalen)
create policy "anon read setting"
  on vh_setting for select to anon using (true);

-- Standaardinstelling
insert into vh_setting (key, value)
values ('intake_questionnaire_id', null)
on conflict (key) do nothing;

-- ─── Anonieme toegang voor portal-aanmelding ──────────────────────────────────

-- Nieuw cliëntrecord aanmaken
create policy "anon insert client"
  on vh_client for insert to anon with check (true);

-- Status bijwerken t/m vragenlijst_ingevuld (niet verder dan arts-goedkeuring)
create policy "anon update client enrollment"
  on vh_client for update to anon
  using (enrollment_status in ('aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld'))
  with check (enrollment_status in ('aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld'));

-- Intake vragenlijst toewijzen
create policy "anon insert qa"
  on vh_questionnaire_assignment for insert to anon with check (true);
