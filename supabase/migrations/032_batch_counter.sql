-- Migratie 032: automatische batchnummering voor Nightingale-verzending
-- Formaat: NL-NH-yyyy-00001/010
--   yyyy   = jaar
--   00001  = volgnummer (per jaar oplopend, 5 cijfers)
--   /010   = aantal kits in de batch (3 cijfers)

-- ── Teller per jaar ───────────────────────────────────────────────────────────

create table if not exists vh_batch_counter (
  year     int  primary key,
  last_seq int  not null default 0
);

alter table vh_batch_counter enable row level security;

-- Lezen mag voor ingelogde medewerkers (voor preview)
create policy "auth read batch counter"
  on vh_batch_counter for select to authenticated using (true);

-- ── Volgend nummer ophalen + reserveren (atomair) ────────────────────────────

create or replace function next_batch_seq(p_year int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
begin
  insert into vh_batch_counter (year, last_seq)
  values (p_year, 1)
  on conflict (year)
  do update set last_seq = vh_batch_counter.last_seq + 1
  returning last_seq into v_seq;
  return v_seq;
end;
$$;

grant execute on function next_batch_seq(int) to authenticated;

-- ── Volgend nummer bekijken zonder te reserveren (voor live preview) ─────────

create or replace function peek_batch_seq(p_year int)
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select last_seq from vh_batch_counter where year = p_year),
    0
  ) + 1;
$$;

grant execute on function peek_batch_seq(int) to authenticated;
