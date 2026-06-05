-- Migratie 033: toewijzing van actiepunten aan medewerkers
-- Acties zijn dynamisch afgeleid (cliëntstatus / kitstatus). We slaan alleen
-- de toewijzing op, geïdentificeerd door action_type + subject_id.

create table if not exists vh_action_assignment (
  id          uuid        primary key default gen_random_uuid(),
  action_type text        not null,
  subject_id  uuid        not null,   -- vh_client.id of vh_testkit.id
  assigned_to uuid        not null references vh_medewerker(id) on delete cascade,
  assigned_by uuid,                   -- auth.users.id van wie toewees
  created_at  timestamptz not null default now(),
  unique (action_type, subject_id)
);

create index on vh_action_assignment (assigned_to);

alter table vh_action_assignment enable row level security;

-- Alle ingelogde medewerkers mogen toewijzingen lezen
create policy "auth read action assignment"
  on vh_action_assignment for select to authenticated using (true);

-- Schrijven loopt via de API (service role) zodat rol-validatie afgedwongen wordt
revoke insert, update, delete on vh_action_assignment from authenticated, anon;
