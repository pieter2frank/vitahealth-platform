-- ─────────────────────────────────────────────────────────────────────────────
-- Migratie 057: uitgebreidere omschrijving per bloedmarker
--
-- Per marker: wat het is/meet, of hoge of lage waarden gunstig zijn, en hoe de
-- waarde met leefstijl te beïnvloeden is. Laat een arts de teksten nalezen.
-- ─────────────────────────────────────────────────────────────────────────────

update vh_biomarker_ref set description = case code
  when 'total_cholesterol'   then 'Totale hoeveelheid cholesterol in het bloed — een vetachtige bouwstof voor celmembranen en hormonen. In deze score is een lagere waarde gunstiger. Te beïnvloeden met minder verzadigd vet, meer vezels, beweging en gewichtsverlies.'
  when 'ldl_cholesterol'     then 'De zogenoemde slechte cholesterol; brengt cholesterol naar de weefsels en draagt bij aan aderverkalking. Lager is beter. Verlagen met minder verzadigd/transvet, meer vezels en beweging; soms medicatie (statines).'
  when 'hdl_cholesterol'     then 'De zogenoemde goede cholesterol; voert overtollig cholesterol af naar de lever. Hoger is gunstiger. Verhogen met beweging, stoppen met roken en gezonde (onverzadigde) vetten.'
  when 'vldl_cholesterol'    then 'Cholesterol in triglyceriderijke deeltjes die vetten door het bloed vervoeren. Lager is gunstiger. Beïnvloeden door suiker en alcohol te beperken, gewichtsverlies en beweging.'
  when 'apob'                then 'Eiwit op alle atherogene deeltjes (LDL/VLDL) — een maat voor het aantal risicodragende deeltjes en een sterke risicomarker. Lager is beter. Zelfde leefstijl als voor LDL.'
  when 'apoa1'               then 'Hoofdeiwit van HDL, betrokken bij de afvoer van cholesterol. Hoger is gunstiger. Beweging, niet roken en onverzadigde vetten verhogen het.'
  when 'apob_apoa1'          then 'Verhouding tussen risicodragende (ApoB) en beschermende (ApoA1) deeltjes; een sterke voorspeller van hart- en vaatrisico. Lager is beter. Verbeteren door LDL/ApoB te verlagen en HDL/ApoA1 te verhogen.'
  when 'total_triglycerides' then 'Vetten die energie opslaan; hoge waarden wijzen op metabole ontregeling. Lager is gunstiger. Sterk te beïnvloeden door minder suiker en alcohol, gewichtsverlies en beweging.'
  when 'glyca'               then 'NMR-maat voor laaggradige, chronische ontsteking; verhoogd bij hoger cardiometabool risico. Lager is beter. Verlaagt met gewichtsverlies, beweging, gezonde voeding en niet roken.'
  when 'hba1c'               then 'Geglyceerd hemoglobine — de gemiddelde bloedsuiker over circa 2 tot 3 maanden; maat voor glucoseregulatie. Lager (binnen normaal) is gunstiger. Beïnvloeden via gewicht, koolhydraatinname en beweging.'
  when 'total_fatty_acids'   then 'Totale concentratie vetzuren in het bloed. Wordt vooral in verhouding beoordeeld; op zichzelf minder sturend. Te beïnvloeden via voeding en gewicht.'
  when 'omega3_pct'          then 'Aandeel omega-3-vetzuren van alle vetzuren; ontstekingsremmend en hart-beschermend. Hoger is gunstiger. Verhogen met vette vis of omega-3-supplementen.'
  when 'omega6_pct'          then 'Aandeel omega-6-vetzuren van alle vetzuren. Vooral de balans met omega-3 telt. Beïnvloeden via het type vetten in de voeding.'
  when 'omega6_omega3'       then 'Verhouding omega-6 tot omega-3; een lagere ratio is gunstiger. Verlagen door meer omega-3 (vette vis) en minder bewerkte, omega-6-rijke oliën.'
  when 'pufa_pct'            then 'Aandeel meervoudig onverzadigde vetzuren. Hoger is doorgaans gunstiger. Kies plantaardige oliën, noten en vette vis boven verzadigd vet.'
  when 'mufa_pct'            then 'Aandeel enkelvoudig onverzadigde vetzuren (onder meer olijfolie). Te beïnvloeden via het type voedingsvet.'
  when 'pufa_mufa'           then 'Verhouding meervoudig tot enkelvoudig onverzadigde vetzuren. Wordt beoordeeld ten opzichte van het optimum; stuurbaar via voedingsvetten.'
  when 'sfa_pct'             then 'Aandeel verzadigde vetzuren; hogere waarden zijn ongunstiger. Lager is beter. Vervang verzadigd vet (vlees, boter, kokos) door onverzadigd vet.'
  when 'la_pct'              then 'Aandeel linolzuur, een essentieel omega-6-vetzuur. Beoordeeld ten opzichte van het optimum; stuurbaar via voeding.'
  when 'dha_pct'             then 'Aandeel DHA, een omega-3-vetzuur dat belangrijk is voor hart en hersenen. Hoger is gunstiger. Verhogen met vette vis of algenolie.'
  when 'creatinine'          then 'Afbraakproduct van de spierstofwisseling; een maat voor de nierfunctie (hoger kan wijzen op verminderde nierfunctie). Beïnvloed door hydratatie, spiermassa en nierfunctie.'
  when 'alanine'             then 'Aminozuur betrokken bij de eiwit- en glucosestofwisseling. Beoordeeld ten opzichte van het optimum; hangt samen met metabole gezondheid en voeding.'
  when 'leucine'             then 'Vertakt-keten aminozuur (BCAA), betrokken bij spiereiwitopbouw; verhoogd bij insulineresistentie. Richting het optimum (lager bij metabole ontregeling) is gunstiger. Beïnvloeden via gewicht en voeding.'
  when 'valine'              then 'Vertakt-keten aminozuur (BCAA). Verhoogde waarden hangen samen met insulineresistentie. Te beïnvloeden via gewicht en voeding.'
  when 'isoleucine'          then 'Vertakt-keten aminozuur (BCAA). Verhoogde waarden hangen samen met insulineresistentie. Te beïnvloeden via gewicht en voeding.'
  when 'total_bcaa'          then 'Som van de vertakt-keten aminozuren (BCAA: leucine, isoleucine, valine); verhoogd bij insulineresistentie. Richting het optimum (lager) is gunstiger. Beïnvloeden door gewichtsverlies en beweging.'
  else description
end
where code in (
  'total_cholesterol','ldl_cholesterol','hdl_cholesterol','vldl_cholesterol','apob','apoa1','apob_apoa1',
  'total_triglycerides','glyca','hba1c','total_fatty_acids','omega3_pct','omega6_pct','omega6_omega3',
  'pufa_pct','mufa_pct','pufa_mufa','sfa_pct','la_pct','dha_pct','creatinine','alanine','leucine','valine',
  'isoleucine','total_bcaa'
);
