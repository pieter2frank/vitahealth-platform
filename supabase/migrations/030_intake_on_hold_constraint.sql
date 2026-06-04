-- Migratie 030: intake_on_hold toevoegen aan enrollment_status CHECK constraint

ALTER TABLE vh_client
  DROP CONSTRAINT IF EXISTS vh_client_enrollment_status_check;

ALTER TABLE vh_client
  ADD CONSTRAINT vh_client_enrollment_status_check CHECK (
    enrollment_status IN (
      'aangemeld',
      'toestemming_gegeven',
      'intake_on_hold',
      'vragenlijst_ingevuld',
      'intake_akkoord',
      'intake_afgewezen',
      'kit_opgestuurd',
      'kit_retour',
      'uitslag_bekend',
      'uitslag_besproken'
    )
  );
