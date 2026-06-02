-- Migratie 018: kit_sent_date kolom voor de nieuwe 'kit_verstuurd' status
-- Statusflow wordt: received → assigned → kit_verstuurd → retour → sent_nightingale → results_available

alter table vh_testkit
  add column if not exists kit_sent_date timestamptz;
