-- Vita Health — voeg 'intake_afgewezen' toe als mogelijke enrollment status

alter table vh_client
  drop constraint vh_client_enrollment_status_check;

alter table vh_client
  add constraint vh_client_enrollment_status_check check (
    enrollment_status in (
      'aangemeld', 'toestemming_gegeven', 'vragenlijst_ingevuld',
      'intake_akkoord', 'intake_afgewezen',
      'kit_opgestuurd', 'kit_retour',
      'uitslag_bekend', 'uitslag_besproken'
    )
  );
