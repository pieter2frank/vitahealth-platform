-- Migratie 044: omgekeerd scoren markeren voor twee rating_10-vragen waar een
-- LAGE score juist goed is. Zonder deze vlag werd een hoge score groen gekleurd
-- terwijl dat juist ongunstig is.
--   d4_klachten  — "Hoeveel last ervaar je van lichamelijke klachten?"
--   d4_patronen  — "Ik vind het soms lastig om gezonde keuzes te maken..."

update vh_questionnaire
set json_content = jsonb_set(
  json_content,
  '{questions}',
  (
    select jsonb_agg(
      case
        when q->>'id' in ('d4_klachten', 'd4_patronen')
          then q || '{"reversed": true}'::jsonb
        else q
      end
    )
    from jsonb_array_elements(json_content -> 'questions') as q
  )
)
where json_content -> 'questions' @> '[{"id":"d4_klachten"}]';
