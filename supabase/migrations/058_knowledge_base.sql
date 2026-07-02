-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 058: kennisbank + gegenereerd advies (fundament voor de AI-laag)
--
-- Volledig additief: bestaande tabellen/flows worden niet geraakt. Zonder een
-- geconfigureerde AI-provider blijft dit ongebruikt.
--
-- Embedding-dimensie = 1024 (past op mistral-embed én bge-m3 op Nebius, zodat
-- van provider wisselen geen her-embedding vereist). Andere dimensie later =
-- kolom aanpassen + opnieuw indexeren.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── Gecureerde kennisdocumenten (algemene content, geen patiëntdata) ───────────
create table vh_knowledge (
  id           uuid primary key default gen_random_uuid(),
  domain       text not null,   -- voeding | beweging | slaap | stress | sociaal | middelen | medicatie | algemeen
  title        text not null,
  body         text,            -- markdown (text) of transcript/samenvatting (video)
  content_type text not null default 'text' check (content_type in ('text', 'video')),
  media_url    text,            -- video-/asset-URL bij content_type = 'video'
  source       text,
  evidence     text,            -- bewijsniveau / notitie
  status       text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  version      int  not null default 1,
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index vh_knowledge_domain_idx on vh_knowledge (domain, status);

-- ── Chunks + embeddings (wat opgehaald wordt) ─────────────────────────────────
create table vh_knowledge_chunk (
  id            uuid primary key default gen_random_uuid(),
  knowledge_id  uuid not null references vh_knowledge(id) on delete cascade,
  domain        text not null,             -- gedenormaliseerd voor snel filteren
  chunk_index   int  not null default 0,
  content       text not null,             -- tekstchunk of transcriptsegment
  start_seconds int,                        -- voor video-segmenten
  end_seconds   int,
  embedding     vector(1024),
  created_at    timestamptz not null default now()
);
create index vh_knowledge_chunk_kid_idx on vh_knowledge_chunk (knowledge_id);
create index vh_knowledge_chunk_emb_idx on vh_knowledge_chunk using hnsw (embedding vector_cosine_ops);

-- ── Gegenereerd advies (concept → goedgekeurd → verzonden) ────────────────────
create table vh_advice (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references vh_client(id) on delete cascade,
  status      text not null default 'draft' check (status in ('draft', 'approved', 'sent')),
  content     jsonb not null,              -- gestructureerd/narratief advies
  model       text,                         -- provider/model dat het genereerde
  sources     jsonb,                        -- gebruikte kennis-chunk-ids (provenance)
  signals     jsonb,                        -- gebruikt signaal-profiel (provenance)
  created_by  text,
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz not null default now()
);
create index vh_advice_client_idx on vh_advice (client_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table vh_knowledge       enable row level security;
alter table vh_knowledge_chunk enable row level security;
alter table vh_advice          enable row level security;

-- Kennis = algemene content → leesbaar voor ingelogde medewerkers.
-- Schrijven/indexeren gebeurt server-side via service_role (bypasst RLS).
create policy "auth read knowledge"       on vh_knowledge       for select to authenticated using (true);
create policy "auth read knowledge chunk" on vh_knowledge_chunk for select to authenticated using (true);

-- Advies is patiënt-gekoppeld → alleen arts/leefstijlarts lezen (zoals rapporten).
create policy "arts read advice" on vh_advice for select to authenticated
  using (exists (select 1 from vh_medewerker where user_id = auth.uid() and role in ('arts', 'leefstijlarts')));

-- ─── Similarity-search (server-side via service_role) ─────────────────────────
create or replace function public.match_knowledge_chunks(
  query_embedding vector(1024),
  match_count     int  default 8,
  filter_domain   text default null
)
returns table (
  chunk_id uuid, knowledge_id uuid, domain text, title text,
  content text, media_url text, start_seconds int, similarity float
)
language sql stable
as $$
  select c.id, c.knowledge_id, c.domain, k.title,
         c.content, k.media_url, c.start_seconds,
         1 - (c.embedding <=> query_embedding) as similarity
  from vh_knowledge_chunk c
  join vh_knowledge k on k.id = c.knowledge_id
  where k.status = 'active'
    and c.embedding is not null
    and (filter_domain is null or c.domain = filter_domain)
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

revoke execute on function public.match_knowledge_chunks(vector, int, text) from public;
grant  execute on function public.match_knowledge_chunks(vector, int, text) to service_role;

notify pgrst, 'reload schema';
