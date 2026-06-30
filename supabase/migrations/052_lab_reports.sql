-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 052: gestructureerde opslag van labrapporten (Nightingale Health Check)
--
-- Slaat de waarden uit het PDF-rapport gestructureerd op:
--   • vh_report             — 1 rij per rapport: metadata + topscores
--   • vh_report_disease_risk — ziekterisico's (5 ziekten per rapport)
--   • vh_report_biomarker    — bloedmarkerwaarden (long format) + referentie
--   • vh_biomarker_ref       — woordenboek met canonieke markers + eenheid/groep
--
-- Alleen de nette tabellen worden geparsed; grafiekpagina's blijven buiten beeld.
-- Schrijven gebeurt server-side (parser via service_role, bypassed RLS).
-- Lezen: arts/leefstijlarts (zelfde rolafbakening als vh_client_document).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Woordenboek: canonieke bloedmarkers ───────────────────────────────────────
create table vh_biomarker_ref (
  code         text primary key,           -- canoniek, bv. 'total_cholesterol'
  display_name text not null,              -- 'Total cholesterol'
  unit         text,                       -- 'mmol/L', 'g/L', '%', 'ratio', 'mmol/mol', 'µmol/L'
  marker_group text,                       -- 'cholesterol', 'fatty_acids', ...
  direction    text check (direction in ('lower_better','higher_better','within_range')),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

comment on table vh_biomarker_ref is 'Canonieke bloedmarkers; direction = welke kant gunstig is (curatable).';

-- ── Rapport: metadata + topscores ─────────────────────────────────────────────
create table vh_report (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references vh_client(id)          on delete cascade,
  document_id           uuid references vh_client_document(id)          on delete set null,
  testkit_id            uuid references vh_testkit(id)                  on delete set null,
  source                text not null default 'nightingale',

  -- Metadata uit de paginakop
  sample_id             text,                       -- bv. '100400124576'
  sample_date           date,
  sex                   text check (sex in ('male','female','other')),
  age                   int,

  -- Topscores
  metabolic_age         int,
  resilience_score      numeric(5,1),               -- 57
  resilience_score_max  int default 100,
  resilience_percentile numeric(5,1),               -- 57 (% mannen jouw leeftijd dat lager scoort)
  resilience_category   text,                       -- bv. 'above_average'

  -- Parser-provenance
  parse_status          text not null default 'needs_review'
                          check (parse_status in ('parsed','needs_review','failed')),
  parsed_at             timestamptz,
  raw_json              jsonb,                      -- ruwe geëxtraheerde data (controle/debug)

  created_at            timestamptz not null default now(),

  unique (document_id)                              -- max één rapport per geüpload PDF
);

create index vh_report_client_idx  on vh_report (client_id, sample_date desc);
create index vh_report_sampleid_idx on vh_report (sample_id);

-- ── Ziekterisico's ────────────────────────────────────────────────────────────
create table vh_report_disease_risk (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references vh_report(id) on delete cascade,
  disease             text not null check (disease in (
                        'heart_attack','ischemic_stroke','type2_diabetes',
                        'chronic_kidney_disease','fatty_liver_disease')),
  result_category     text check (result_category in (
                        'average_or_lower','higher_than_average','notably_above_average')),
  percentile          numeric(5,1),                 -- geparsed percentiel indien beschikbaar
  risk_current_pct    numeric(6,2),                 -- huidig 10-jaars risico
  risk_avg_pct        numeric(6,2),                 -- gemiddeld risico voor leeftijd
  risk_age70_pct      numeric(6,2),                 -- risico op leeftijd 70
  risk_age70_avg_pct  numeric(6,2),                 -- gemiddeld op leeftijd 70
  created_at          timestamptz not null default now(),
  unique (report_id, disease)
);

-- ── Bloedmarkerwaarden (long format) ──────────────────────────────────────────
create table vh_report_biomarker (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references vh_report(id) on delete cascade,
  marker_code  text not null references vh_biomarker_ref(code),
  value        numeric,
  unit         text,                                -- meegekopieerd (historische juistheid)
  ref_optimal  numeric,                             -- "optimal range with respect to the score"
  ref_low      numeric,                             -- indien een echt bereik wordt vermeld
  ref_high     numeric,
  association  text check (association in ('strongest','moderate','weakest')),
  created_at   timestamptz not null default now(),
  unique (report_id, marker_code)
);

create index vh_report_biomarker_marker_idx on vh_report_biomarker (marker_code);
create index vh_report_biomarker_report_idx on vh_report_biomarker (report_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
-- Medische rapportdata: alleen arts/leefstijlarts lezen. Schrijven via service_role.
alter table vh_report              enable row level security;
alter table vh_report_disease_risk enable row level security;
alter table vh_report_biomarker    enable row level security;
alter table vh_biomarker_ref       enable row level security;

create policy "arts read reports"
  on vh_report for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('arts','leefstijlarts')));

create policy "arts read report disease risk"
  on vh_report_disease_risk for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('arts','leefstijlarts')));

create policy "arts read report biomarkers"
  on vh_report_biomarker for select to authenticated
  using (exists (select 1 from vh_medewerker
                 where user_id = auth.uid() and role in ('arts','leefstijlarts')));

-- Woordenboek is niet gevoelig → leesbaar voor alle ingelogde medewerkers.
create policy "authenticated read biomarker ref"
  on vh_biomarker_ref for select to authenticated
  using (true);

-- ─── Seed: canonieke bloedmarkers uit het Nightingale-rapport ─────────────────
insert into vh_biomarker_ref (code, display_name, unit, marker_group, direction, sort_order) values
  ('total_cholesterol',  'Total cholesterol',          'mmol/L',   'cholesterol',         'lower_better',  10),
  ('ldl_cholesterol',    'LDL cholesterol',            'mmol/L',   'cholesterol',         'lower_better',  11),
  ('hdl_cholesterol',    'HDL cholesterol',            'mmol/L',   'cholesterol',         'higher_better', 12),
  ('vldl_cholesterol',   'VLDL cholesterol',           'mmol/L',   'cholesterol',         'lower_better',  13),
  ('apob',               'Apolipoprotein B',           'g/L',      'apolipoproteins',     'lower_better',  20),
  ('apoa1',              'Apolipoprotein A1',          'g/L',      'apolipoproteins',     'higher_better', 21),
  ('apob_apoa1',         'ApoB/ApoA1',                 'ratio',    'apolipoproteins',     'lower_better',  22),
  ('total_triglycerides','Total triglycerides',        'mmol/L',   'triglycerides',       'lower_better',  30),
  ('glyca',              'Glycoprotein acetyls (GlycA)','mmol/L',  'inflammation',        'lower_better',  40),
  ('hba1c',              'HbA1c',                      'mmol/mol', 'glycated_hemoglobin', 'lower_better',  50),
  ('total_fatty_acids',  'Total fatty acids',          'mmol/L',   'fatty_acids',         null,            60),
  ('omega3_pct',         'Omega-3 %',                  '%',        'fatty_acids',         'higher_better', 61),
  ('omega6_pct',         'Omega-6 %',                  '%',        'fatty_acids',         null,            62),
  ('omega6_omega3',      'Omega-6/Omega-3',            'ratio',    'fatty_acids',         'lower_better',  63),
  ('pufa_pct',           'PUFA %',                     '%',        'fatty_acids',         null,            64),
  ('mufa_pct',           'MUFA %',                     '%',        'fatty_acids',         null,            65),
  ('pufa_mufa',          'PUFA/MUFA',                  'ratio',    'fatty_acids',         null,            66),
  ('sfa_pct',            'SFA %',                      '%',        'fatty_acids',         'lower_better',  67),
  ('la_pct',             'LA %',                       '%',        'fatty_acids',         null,            68),
  ('dha_pct',            'DHA %',                      '%',        'fatty_acids',         'higher_better', 69),
  ('creatinine',         'Creatinine',                 'µmol/L',   'fluid_balance',       null,            70),
  ('alanine',            'Alanine',                    'mmol/L',   'amino_acids',         null,            80),
  ('leucine',            'Leucine',                    'mmol/L',   'amino_acids',         null,            81),
  ('valine',             'Valine',                     'mmol/L',   'amino_acids',         null,            82),
  ('isoleucine',         'Isoleucine',                 'mmol/L',   'amino_acids',         null,            83),
  ('total_bcaa',         'Total BCAAs',                'mmol/L',   'amino_acids',         null,            84)
on conflict (code) do nothing;
