-- 081: Als-dan richtlijnen voor de adviesgeneratie.
--
-- Artsen leggen hier beslisregels vast ("ALS LDL > 3,0 ÉN roker DAN ...").
-- De applicatie evalueert de condities deterministisch tegen het dossier
-- (lib/ai/rules.ts); de instructies van matchende regels gaan als verplichte
-- richtlijnen mee in de adviesprompt. Zo is het als-dan-gedrag reproduceerbaar
-- en auditeerbaar — niet afhankelijk van wat het taalmodel "vindt".
--
-- conditions: jsonb-array (alle condities moeten waar zijn — AND). Vormen:
--   {"kind":"biomarker","code":"...","op":"gt|gte|lt|lte|attention","value":3}
--   {"kind":"question","qid":"...","op":"eq|lte|gte","value":true|5}
--   {"kind":"disease","code":"heart_attack","op":"elevated"}
--   {"kind":"bmi","op":"gte","value":30}
--   {"kind":"age","op":"gte|lte","value":50}
--   {"kind":"gender","value":"man|vrouw"}

create table vh_advice_rule (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  domain      text check (domain in ('voeding','beweging','slaap','stress','sociaal','middelen','medicatie','algemeen')),
  conditions  jsonb not null default '[]'::jsonb,
  instruction text not null,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index vh_advice_rule_active_idx on vh_advice_rule (active);

alter table vh_advice_rule enable row level security;

-- Lezen voor ingelogde medewerkers; schrijven uitsluitend via service_role
-- (API-routes met rolcontrole), zoals bij vh_knowledge.
create policy "auth read advice rule" on vh_advice_rule for select to authenticated using (true);
