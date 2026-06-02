-- Migratie 019: voeg 'kit_verstuurd' toe aan de testkit_status enum
-- Dit is de tussenstatus tussen 'assigned' en 'retour'

ALTER TYPE testkit_status ADD VALUE IF NOT EXISTS 'kit_verstuurd' AFTER 'assigned';
