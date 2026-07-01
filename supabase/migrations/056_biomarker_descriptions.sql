-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 056: korte omschrijving per bloedmarker (voor tooltips in de review)
--
-- Toont bij elke meetwaarde wat er gemeten wordt en wat het stofje is.
-- ─────────────────────────────────────────────────────────────────────────────

alter table vh_biomarker_ref add column if not exists description text;

update vh_biomarker_ref set description = case code
  when 'total_cholesterol'   then 'Totaal cholesterol — vetachtige stof en bouwsteen van celmembranen en hormonen; totale hoeveelheid cholesterol in het bloed.'
  when 'ldl_cholesterol'     then 'LDL-cholesterol — de ''slechte'' cholesterol; transporteert cholesterol naar de weefsels. Hoge waarden verhogen het risico op aderverkalking.'
  when 'hdl_cholesterol'     then 'HDL-cholesterol — de ''goede'' cholesterol; voert overtollig cholesterol af naar de lever. Hogere waarden zijn gunstig.'
  when 'vldl_cholesterol'    then 'VLDL-cholesterol — cholesterol in triglyceriderijke deeltjes; vervoert vetten door het bloed.'
  when 'apob'                then 'Apolipoproteïne B — eiwit op alle atherogene (LDL/VLDL) deeltjes; maat voor het aantal risicodragende lipoproteïnen.'
  when 'apoa1'               then 'Apolipoproteïne A1 — hoofdeiwit van HDL; betrokken bij de afvoer van cholesterol.'
  when 'apob_apoa1'          then 'ApoB/ApoA1-ratio — verhouding tussen atherogene en beschermende deeltjes; sterke voorspeller van hart- en vaatrisico.'
  when 'total_triglycerides' then 'Triglyceriden — vetten die energie opslaan; hoge waarden hangen samen met metabole ontregeling.'
  when 'glyca'               then 'GlycA (glycoproteïne-acetylen) — NMR-maat voor laaggradige, chronische ontsteking; verhoogd bij hoger cardiometabool risico.'
  when 'hba1c'               then 'HbA1c — geglyceerd hemoglobine; weerspiegelt de gemiddelde bloedsuiker over ~2–3 maanden (maat voor glucoseregulatie).'
  when 'total_fatty_acids'   then 'Totaal vetzuren — de totale concentratie vetzuren in het bloed.'
  when 'omega3_pct'          then 'Omega-3 % — aandeel omega-3-vetzuren van de totale vetzuren; doorgaans gunstig (ontstekingsremmend).'
  when 'omega6_pct'          then 'Omega-6 % — aandeel omega-6-vetzuren van de totale vetzuren.'
  when 'omega6_omega3'       then 'Omega-6/Omega-3-ratio — verhouding tussen omega-6 en omega-3; een lagere ratio is gunstiger.'
  when 'pufa_pct'            then 'PUFA % — aandeel meervoudig onverzadigde vetzuren.'
  when 'mufa_pct'            then 'MUFA % — aandeel enkelvoudig onverzadigde vetzuren.'
  when 'pufa_mufa'           then 'PUFA/MUFA-ratio — verhouding meervoudig t.o.v. enkelvoudig onverzadigde vetzuren.'
  when 'sfa_pct'             then 'SFA % — aandeel verzadigde vetzuren; hogere waarden zijn ongunstiger.'
  when 'la_pct'              then 'LA % — aandeel linolzuur, een omega-6-vetzuur.'
  when 'dha_pct'             then 'DHA % — aandeel docosahexaeenzuur, een omega-3-vetzuur; belangrijk voor hart en hersenen.'
  when 'creatinine'          then 'Creatinine — afbraakproduct van de spierstofwisseling; maat voor de nierfunctie.'
  when 'alanine'             then 'Alanine — aminozuur; betrokken bij de eiwit- en glucosestofwisseling.'
  when 'leucine'             then 'Leucine — vertakt-keten aminozuur (BCAA); betrokken bij spiereiwitopbouw, verhoogd bij insulineresistentie.'
  when 'valine'              then 'Valine — vertakt-keten aminozuur (BCAA).'
  when 'isoleucine'          then 'Isoleucine — vertakt-keten aminozuur (BCAA).'
  when 'total_bcaa'          then 'Totaal BCAA''s — som van de vertakt-keten aminozuren (leucine, isoleucine, valine); verhoogd bij insulineresistentie.'
  else description
end
where code in (
  'total_cholesterol','ldl_cholesterol','hdl_cholesterol','vldl_cholesterol','apob','apoa1','apob_apoa1',
  'total_triglycerides','glyca','hba1c','total_fatty_acids','omega3_pct','omega6_pct','omega6_omega3',
  'pufa_pct','mufa_pct','pufa_mufa','sfa_pct','la_pct','dha_pct','creatinine','alanine','leucine','valine',
  'isoleucine','total_bcaa'
);
