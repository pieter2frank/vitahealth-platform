-- Vita Health — module 6 & 7: Vragenlijsten & Programma's

-- Vragenlijst definities (importeerbaar via JSON)
create table vh_questionnaire (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        text not null,
  status       text not null default 'active',   -- active | draft
  json_content jsonb not null,
  created_at   timestamptz not null default now()
);

-- Programma definities (importeerbaar via JSON)
create table vh_program (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  description   text,
  tags          text[] not null default '{}',
  is_premium    boolean not null default false,
  duration_days int,
  status        text not null default 'active',
  json_content  jsonb not null,
  created_at    timestamptz not null default now()
);

-- Vragenlijst toewijzingen aan cliënten
create table vh_questionnaire_assignment (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references vh_questionnaire(id) on delete cascade,
  client_id        uuid not null references vh_client(id) on delete cascade,
  status           text not null default 'pending',   -- pending | completed
  assigned_at      timestamptz not null default now(),
  completed_at     timestamptz
);

create index vh_qa_client_idx on vh_questionnaire_assignment (client_id);
create index vh_qa_questionnaire_idx on vh_questionnaire_assignment (questionnaire_id);

-- Opgeslagen antwoorden
create table vh_questionnaire_response (
  id               uuid primary key default gen_random_uuid(),
  assignment_id    uuid not null references vh_questionnaire_assignment(id) on delete cascade,
  questionnaire_id uuid not null references vh_questionnaire(id),
  client_id        uuid not null references vh_client(id),
  responses        jsonb not null default '{}',
  completed_at     timestamptz not null default now()
);

-- Programma toewijzingen aan cliënten
create table vh_program_assignment (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references vh_program(id) on delete cascade,
  client_id   uuid not null references vh_client(id) on delete cascade,
  start_date  date,
  status      text not null default 'active',   -- active | completed | paused
  assigned_at timestamptz not null default now()
);

create index vh_pa_client_idx  on vh_program_assignment (client_id);
create index vh_pa_program_idx on vh_program_assignment (program_id);

-- RLS
alter table vh_questionnaire            enable row level security;
alter table vh_program                  enable row level security;
alter table vh_questionnaire_assignment enable row level security;
alter table vh_questionnaire_response   enable row level security;
alter table vh_program_assignment       enable row level security;

-- Policies: authenticated = medewerkers portaal
create policy "auth select questionnaire"    on vh_questionnaire            for select to authenticated using (true);
create policy "auth insert questionnaire"    on vh_questionnaire            for insert to authenticated with check (true);
create policy "auth update questionnaire"    on vh_questionnaire            for update to authenticated using (true);
create policy "auth delete questionnaire"    on vh_questionnaire            for delete to authenticated using (true);

create policy "auth select program"          on vh_program                  for select to authenticated using (true);
create policy "auth insert program"          on vh_program                  for insert to authenticated with check (true);
create policy "auth update program"          on vh_program                  for update to authenticated using (true);
create policy "auth delete program"          on vh_program                  for delete to authenticated using (true);

create policy "auth select qa"               on vh_questionnaire_assignment for select to authenticated using (true);
create policy "auth insert qa"               on vh_questionnaire_assignment for insert to authenticated with check (true);
create policy "auth update qa"               on vh_questionnaire_assignment for update to authenticated using (true);
create policy "auth delete qa"               on vh_questionnaire_assignment for delete to authenticated using (true);

create policy "auth select qr"               on vh_questionnaire_response   for select to authenticated using (true);
create policy "auth insert qr"               on vh_questionnaire_response   for insert to authenticated with check (true);

create policy "auth select pa"               on vh_program_assignment       for select to authenticated using (true);
create policy "auth insert pa"               on vh_program_assignment       for insert to authenticated with check (true);
create policy "auth update pa"               on vh_program_assignment       for update to authenticated using (true);
create policy "auth delete pa"               on vh_program_assignment       for delete to authenticated using (true);
