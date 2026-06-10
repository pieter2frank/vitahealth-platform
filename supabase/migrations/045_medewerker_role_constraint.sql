-- Migratie 045: 'medewerker' toevoegen aan de toegestane rollen van vh_medewerker.
-- De originele constraint (006) liet alleen admin/arts/leefstijlarts toe, terwijl
-- het uitnodigformulier ook 'medewerker' aanbiedt.

alter table vh_medewerker
  drop constraint if exists vh_medewerker_role_check;

alter table vh_medewerker
  add constraint vh_medewerker_role_check
    check (role in ('admin', 'arts', 'leefstijlarts', 'medewerker'));
