-- 082: Instellingen voor de AI-advieslaag.
--
-- Key-value-opslag voor door de arts/beheerder aanpasbare onderdelen van de
-- adviesgeneratie. Eerste gebruik: het adviessjabloon (key 'advies_sjabloon').
-- Ontbreekt een key, dan geldt de standaard uit de code (lib/ai/advice.ts) —
-- de tabel hoeft dus nooit gevuld te zijn.

create table vh_ai_setting (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table vh_ai_setting enable row level security;

-- Lezen voor ingelogde medewerkers; schrijven uitsluitend via service_role
-- (API-routes met rolcontrole), zoals bij vh_knowledge en vh_advice_rule.
create policy "auth read ai setting" on vh_ai_setting for select to authenticated using (true);
