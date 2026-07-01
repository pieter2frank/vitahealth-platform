-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 055: projectieleeftijd van de ziekterisico's
--
-- Het toekomstige risico is niet altijd op leeftijd 70 — het rapport projecteert
-- naar een leeftijd die afhangt van de huidige leeftijd (bv. 55 voor een 39-jarige).
-- projection_age bewaart die leeftijd zodat de weergave "risico 55jr" kan tonen.
-- (De bestaande kolommen risk_age70_* bevatten het risico op déze projectieleeftijd.)
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_report add column if not exists projection_age int;
