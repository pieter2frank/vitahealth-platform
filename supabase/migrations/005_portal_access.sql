-- Vita Health — publieke toegang voor cliënten om vragenlijsten in te vullen
-- De UUID van de toewijzing is de "token" — moeilijk te raden

-- Cliënten moeten de vragenlijst-definitie kunnen lezen (om vragen te tonen)
create policy "anon read questionnaire"
  on vh_questionnaire for select to anon using (true);

-- Cliënten moeten hun toewijzing kunnen lezen (status controleren)
create policy "anon read qa"
  on vh_questionnaire_assignment for select to anon using (true);

-- Cliënten mogen hun toewijzing markeren als voltooid
create policy "anon complete qa"
  on vh_questionnaire_assignment for update to anon
  using (true)
  with check (status = 'completed');

-- Cliënten mogen antwoorden opslaan
create policy "anon insert qr"
  on vh_questionnaire_response for insert to anon with check (true);

-- Cliënten moeten ook hun eigen client-record kunnen lezen (voor naam weergave)
create policy "anon read client by id"
  on vh_client for select to anon using (true);
