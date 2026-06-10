-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 046: versiebeheer voor vragenlijsten
--
-- Doel: vragenlijsten online kunnen bewerken zonder al gegeven antwoorden te
-- beschadigen. Elke publicatie is een onveranderlijke versie. Elk antwoord
-- wordt gestempeld met de versie waartegen het is ingevuld, zodat resultaten
-- altijd tegen de juiste definitie kunnen worden weergegeven.
-- ─────────────────────────────────────────────────────────────────────────────

-- Actuele versie van de (gepubliceerde) vragenlijst
alter table vh_questionnaire
  add column if not exists version int not null default 1;

-- Snapshot per gepubliceerde versie
create table if not exists vh_questionnaire_version (
  id               uuid        primary key default gen_random_uuid(),
  questionnaire_id uuid        not null references vh_questionnaire(id) on delete cascade,
  version          int         not null,
  json_content     jsonb       not null,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  unique (questionnaire_id, version)
);

alter table vh_questionnaire_version enable row level security;

create policy "auth read questionnaire versions"
  on vh_questionnaire_version for select to authenticated using (true);

revoke insert, update, delete on vh_questionnaire_version from authenticated, anon;

-- Antwoorden stempelen met de versie waartegen ze zijn ingevuld
alter table vh_questionnaire_response
  add column if not exists questionnaire_version int;

-- Trigger: stempel automatisch de actuele versie van de vragenlijst
create or replace function public.stamp_response_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.questionnaire_version is null then
    select version into NEW.questionnaire_version
    from vh_questionnaire where id = NEW.questionnaire_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists stamp_version on vh_questionnaire_response;
create trigger stamp_version
  before insert on vh_questionnaire_response
  for each row execute function public.stamp_response_version();

-- ── Backfill: bestaande vragenlijsten als versie 1 vastleggen ─────────────────

insert into vh_questionnaire_version (questionnaire_id, version, json_content)
select id, 1, json_content
from vh_questionnaire
where not exists (
  select 1 from vh_questionnaire_version v
  where v.questionnaire_id = vh_questionnaire.id and v.version = 1
);

-- Bestaande antwoorden op versie 1 zetten
update vh_questionnaire_response
set questionnaire_version = 1
where questionnaire_version is null;
