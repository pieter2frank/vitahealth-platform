-- Migratie 023: intake_on_hold status
-- Cliënt geeft aan dat één van de uitsluitingscriteria mogelijk op hem/haar van
-- toepassing is. Medewerker neemt contact op en beslist: doorgaan of stoppen.

ALTER TYPE enrollment_status ADD VALUE IF NOT EXISTS 'intake_on_hold' AFTER 'toestemming_gegeven';
