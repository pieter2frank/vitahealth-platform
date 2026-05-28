-- Vita Health — medewerker rollen
-- Uitvoeren via Supabase SQL Editor

create table vh_medewerker (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  role       text not null default 'admin',
  created_at timestamptz not null default now(),
  constraint vh_medewerker_user_unique unique (user_id),
  constraint vh_medewerker_role_check check (role in ('admin', 'arts', 'leefstijlarts'))
);

-- RLS
alter table vh_medewerker enable row level security;

-- Iedere medewerker kan zijn eigen profiel lezen
-- (ook gebruikt in subquery's van andere RLS policies)
create policy "medewerker read own"
  on vh_medewerker for select to authenticated
  using (auth.uid() = user_id);

-- Questionnaire responses: alleen leesbaar voor arts en leefstijlarts
-- Verwijder de open policy uit 004 en vervang door rol-beperkte versie
drop policy if exists "auth select qr" on vh_questionnaire_response;

create policy "arts read questionnaire responses"
  on vh_questionnaire_response for select to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

-- ─── Na uitvoeren: voeg handmatig je eerste medewerkers toe ───────────────────
-- Ga naar Supabase > Authentication > Users om het user_id te vinden
--
-- insert into vh_medewerker (user_id, name, role) values
--   ('<uuid-van-user>', 'Naam Achternaam', 'arts');
--
-- Rollen: admin | arts | leefstijlarts
