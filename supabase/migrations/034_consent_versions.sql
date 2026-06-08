-- Migratie 034: toestemmingen beheerbaar maken met versiebeheer
-- De teksten staan voortaan in de database. Bij elke wijziging wordt een
-- nieuwe versie opgeslagen; de vorige versies blijven bewaard (legaal bewijs
-- van wat een cliënt destijds heeft geaccepteerd).

create table if not exists vh_consent_version (
  id             uuid        primary key default gen_random_uuid(),
  version        int         not null unique,
  required_texts jsonb       not null default '[]'::jsonb,  -- string[]
  optional_texts jsonb       not null default '[]'::jsonb,  -- string[]
  is_active      boolean     not null default false,
  created_at     timestamptz not null default now(),
  created_by     uuid
);

-- Slechts één actieve versie tegelijk
create unique index if not exists vh_consent_version_one_active
  on vh_consent_version (is_active) where is_active;

alter table vh_consent_version enable row level security;

-- Medewerkers mogen versies lezen (admin-pagina)
create policy "auth read consent versions"
  on vh_consent_version for select to authenticated using (true);

-- Schrijven loopt via de API (service role), niet rechtstreeks
revoke insert, update, delete on vh_consent_version from authenticated, anon;

-- ── Seed: huidige teksten als versie 2 (actief) ──────────────────────────────

insert into vh_consent_version (version, is_active, required_texts, optional_texts)
values (
  2, true,
  jsonb_build_array(
    'Ik heb de deelnemersinformatie gelezen en begrepen, heb voldoende gelegenheid gehad om vragen te stellen, begrijp dat deelname volledig vrijwillig is en dat ik mijn deelname op elk moment zonder opgave van reden kan beëindigen.',
    'Ik geef uitdrukkelijk toestemming voor het verwerken van mijn persoonsgegevens en gezondheidsgegevens door Vita Health, het delen van mijn gegevens (alleen geboortedatum en geslacht) en samplecode met Nightingale Health voor laboratoriumanalyse, en de ontvangst en beoordeling van mijn resultaten door Vita Health en een medisch deskundige.',
    'Ik verklaar de gezondheidsvragenlijst volledig en naar waarheid in te vullen en stem in dat Vita Health contact met mij opneemt over mijn deelname, de sample-afname, mijn uitslag en eventuele vervolgstappen.',
    'Ik begrijp dat de Vita Health Check geen medische diagnose stelt en geen vervanging is van reguliere medische zorg. Bij gezondheidsklachten raadpleeg ik altijd mijn huisarts of, bij spoed, de huisartsenpost of 112.'
  ),
  jsonb_build_array(
    'Ik geef toestemming dat mijn niet-herleidbare feedback en procesgegevens worden gebruikt om het proces te verbeteren voor een grotere pilot.',
    'Ik geef toestemming dat Vita Health mij na afloop benadert voor feedback over mijn ervaring met de Vita Health Check.',
    'Ik geef toestemming dat mijn gegevens, uitsluitend in gepseudonimiseerde of geaggregeerde vorm, worden gebruikt voor evaluatie van de dry-run.'
  )
)
on conflict (version) do nothing;

-- ── RPC: actieve toestemmingen ophalen (portaal, ook anoniem) ────────────────

create or replace function get_active_consents()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'version',  v.version,
    'required', v.required_texts,
    'optional', v.optional_texts
  )
  from vh_consent_version v
  where v.is_active
  order by v.version desc
  limit 1;
$$;

grant execute on function get_active_consents() to anon, authenticated;
