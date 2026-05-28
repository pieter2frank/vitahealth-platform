-- Vita Health — PDF-uitslagen per cliënt
-- Uitvoeren via Supabase SQL Editor

-- ─── Storage bucket ──────────────────────────────────────────────────────────
-- Privé bucket, max 20 MB per bestand, alleen PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-documents', 'client-documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- ─── Storage policies ─────────────────────────────────────────────────────────
create policy "arts read storage"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts upload storage"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'client-documents'
    and exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts delete storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'client-documents'
    and exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

-- ─── Database tabel ───────────────────────────────────────────────────────────
create table vh_client_document (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references vh_client(id) on delete cascade,
  filename     text not null,
  storage_path text not null,
  file_size    bigint,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);

create index vh_client_doc_client_idx on vh_client_document (client_id, created_at desc);

alter table vh_client_document enable row level security;

create policy "arts read documents"
  on vh_client_document for select to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts insert documents"
  on vh_client_document for insert to authenticated
  with check (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );

create policy "arts delete documents"
  on vh_client_document for delete to authenticated
  using (
    exists (
      select 1 from vh_medewerker
      where user_id = auth.uid()
        and role in ('arts', 'leefstijlarts')
    )
  );
