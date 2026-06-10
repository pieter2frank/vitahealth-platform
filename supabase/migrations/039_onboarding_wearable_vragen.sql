-- Migratie 039: twee extra vragen onderaan "Motivatie & doelen"
--   1. Wearable-gebruik (boolean)
--   2. Bereidheid data te delen (radio ja/nee/misschien) + open opmerking
-- Idempotent: doet niets als d5_wearable al bestaat.

update vh_questionnaire
set json_content = jsonb_set(
  json_content,
  '{questions}',
  (json_content -> 'questions') || '[
    {
      "id": "d5_wearable",
      "type": "boolean",
      "label": "Houd je gegevens over je gezondheid, beweging en slaap bij met een wearable (bv. Garmin, Polar, Apple Watch, Fitbit, etc.)?",
      "category": "Motivatie & doelen",
      "required": true
    },
    {
      "id": "d5_data_delen",
      "type": "radio",
      "label": "Zou je dit soort gegevens willen delen met dit platform, zodat we gerichter kunnen adviseren hoe je je gezondheid en vitaliteit kunt verbeteren?",
      "category": "Motivatie & doelen",
      "required": true,
      "options": [
        { "value": "ja",        "label": "Ja" },
        { "value": "nee",       "label": "Nee" },
        { "value": "misschien", "label": "Misschien" }
      ]
    },
    {
      "id": "d5_data_delen_opmerking",
      "type": "long_text",
      "label": "Heb je hier een opmerking over? (optioneel)",
      "category": "Motivatie & doelen",
      "required": false
    }
  ]'::jsonb
)
where json_content ->> 'id' = 'vh-onboarding-v1'
  and not (json_content -> 'questions' @> '[{"id": "d5_wearable"}]');
