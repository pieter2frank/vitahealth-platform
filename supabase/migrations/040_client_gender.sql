-- Migratie 040: geslacht-kolom op vh_client
-- Geslacht hoort bij de basisgegevens (en wordt met Nightingale gedeeld:
-- alleen geboortedatum + geslacht). Waarden komen overeen met de vragenlijst.

alter table vh_client
  add column if not exists gender text;

alter table vh_client
  drop constraint if exists vh_client_gender_check;

alter table vh_client
  add constraint vh_client_gender_check check (
    gender is null or gender in ('man', 'vrouw', 'anders', 'zeg_liever_niet')
  );
