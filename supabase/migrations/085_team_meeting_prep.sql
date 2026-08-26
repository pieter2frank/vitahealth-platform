-- 085: AI-voorbereiding per besprekingscasus (hoort bij 084).
-- De AI-samenvatting ("wat is hier de kernvraag?") wordt per casus gegenereerd
-- op basis van het pseudonieme casusdocument en gecachet op de casusrij.

alter table vh_team_meeting_case
  add column ai_prep    text,
  add column ai_prep_at timestamptz;
