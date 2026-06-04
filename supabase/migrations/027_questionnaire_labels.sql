-- Migratie 027: ontbrekende labels toevoegen aan zelfzorg vragen
-- De 5 rating_10 vragen in de categorie "Klachten, energie en zelfzorg"
-- missen leftLabel en rightLabel.

update vh_questionnaire
set json_content = jsonb_set(
  json_content,
  '{questions}',
  (
    select jsonb_agg(
      case
        when q->>'id' = 'd4_zelfzorg_1' then q || '{"leftLabel":"Helemaal niet","rightLabel":"Volledig"}'
        when q->>'id' = 'd4_zelfzorg_2' then q || '{"leftLabel":"Helemaal niet","rightLabel":"Volledig"}'
        when q->>'id' = 'd4_zelfzorg_3' then q || '{"leftLabel":"Helemaal niet","rightLabel":"Volledig"}'
        when q->>'id' = 'd4_patronen'   then q || '{"leftLabel":"Helemaal niet","rightLabel":"Volledig"}'
        when q->>'id' = 'd4_balans'     then q || '{"leftLabel":"Helemaal niet","rightLabel":"Volledig"}'
        else q
      end
    )
    from jsonb_array_elements(json_content->'questions') as q
  )
)
where json_content->'questions' @> '[{"id":"d4_zelfzorg_1"}]';
