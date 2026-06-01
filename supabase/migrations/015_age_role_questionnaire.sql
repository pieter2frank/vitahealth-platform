-- Migratie 015: leeftijdsvraag in intake-vragenlijst markeren als 'age_years'
--
-- Vragen met role = 'age_years' worden in het portaalformulier niet getoond.
-- De waarde wordt automatisch berekend op basis van de geboortedatum van de cliënt.
--
-- Werkt op de vraag waarvan het label 'leeftijd' bevat (case-insensitief),
-- binnen de vragenlijst die is ingesteld als intake_questionnaire_id.

UPDATE vh_questionnaire
SET json_content = jsonb_set(
  json_content,
  '{questions}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN lower(q->>'label') LIKE '%leeftijd%'
        THEN jsonb_set(q, '{role}', '"age_years"')
        ELSE q
      END
    )
    FROM jsonb_array_elements(json_content->'questions') AS q
  )
)
WHERE id = (
  SELECT (value)::uuid
  FROM vh_setting
  WHERE key = 'intake_questionnaire_id'
);
