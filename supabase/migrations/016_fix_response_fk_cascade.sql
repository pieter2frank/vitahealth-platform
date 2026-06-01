-- Migratie 016: ON DELETE CASCADE toevoegen aan vh_questionnaire_response.client_id
--
-- De foreign key op client_id miste CASCADE waardoor een cliënt niet verwijderd
-- kon worden zolang er vragenlijst-antwoorden aan gekoppeld waren.

alter table vh_questionnaire_response
  drop constraint vh_questionnaire_response_client_id_fkey;

alter table vh_questionnaire_response
  add constraint vh_questionnaire_response_client_id_fkey
    foreign key (client_id)
    references vh_client(id)
    on delete cascade;
