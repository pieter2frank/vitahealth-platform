-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 071: facturen (fase 2)
--
-- Doorlopende, gapless factuurnummering (wettelijk verplicht) via een teller per
-- jaar. Facturen én creditfacturen delen dezelfde reeks. PDF's in een private
-- storage-bucket 'invoices' (alleen server-side/service_role).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists vh_invoice (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references vh_order(id) on delete cascade,
  type         text not null default 'invoice' check (type in ('invoice', 'credit')),
  year         int  not null,
  seq          int  not null,
  number       text not null unique,          -- bv '2026-0001'
  net_cents    int  not null,                 -- excl. btw (kan negatief bij credit)
  vat_cents    int  not null,
  gross_cents  int  not null,
  vat_rate     numeric(5,2) not null,
  currency     text not null default 'EUR',
  storage_path text,
  issued_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (order_id, type)
);
create index if not exists vh_invoice_order_idx on vh_invoice (order_id);

alter table vh_invoice enable row level security;
drop policy if exists "auth read invoice" on vh_invoice;
create policy "auth read invoice" on vh_invoice for select to authenticated using (true);

-- ── Doorlopende nummering (per jaar, atomisch) ────────────────────────────────
create table if not exists vh_invoice_seq (
  year        int primary key,
  last_number int not null default 0
);

create or replace function next_invoice_number(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v int;
begin
  insert into vh_invoice_seq (year, last_number) values (p_year, 1)
  on conflict (year) do update set last_number = vh_invoice_seq.last_number + 1
  returning last_number into v;
  return v;
end;
$$;
revoke execute on function next_invoice_number(int) from public;
grant  execute on function next_invoice_number(int) to service_role;

-- ── Private bucket voor factuur-PDF's ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 5242880, array['application/pdf'])
on conflict (id) do nothing;

notify pgrst, 'reload schema';
