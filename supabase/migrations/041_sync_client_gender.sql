-- Migratie 041: geslacht automatisch overnemen van de intake-vragenlijst
-- naar het cliëntrecord (vh_client.gender).
--
-- Bron: het antwoord op vraag 'd1_geslacht' (waarden man/vrouw/anders/
-- zeg_liever_niet). Wordt alleen gezet als het cliëntrecord nog geen geslacht
-- heeft — een handmatige aanpassing door een medewerker wordt dus niet
-- overschreven. Werkt server-side (trigger), dus ongeacht RLS.

create or replace function public.sync_client_gender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
begin
  v_gender := NEW.responses ->> 'd1_geslacht';
  if v_gender in ('man', 'vrouw', 'anders', 'zeg_liever_niet') then
    update vh_client
    set gender = v_gender
    where id = NEW.client_id
      and (gender is null or gender = '');
  end if;
  return null;
end;
$$;

drop trigger if exists sync_gender on vh_questionnaire_response;
create trigger sync_gender
  after insert on vh_questionnaire_response
  for each row execute function public.sync_client_gender();

-- ── Backfill: bestaande cliënten op basis van hun laatste vragenlijst ─────────

update vh_client c
set gender = r.g
from (
  select distinct on (client_id)
         client_id,
         responses ->> 'd1_geslacht' as g
  from   vh_questionnaire_response
  order  by client_id, completed_at desc
) r
where c.id = r.client_id
  and (c.gender is null or c.gender = '')
  and r.g in ('man', 'vrouw', 'anders', 'zeg_liever_niet');
