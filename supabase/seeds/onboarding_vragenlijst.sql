-- Vita Health — Onboarding vragenlijst seed
-- Uitvoeren via: Supabase Dashboard → SQL Editor
-- Idempotent: doet niets als de slug al bestaat

insert into vh_questionnaire (slug, title, status, json_content)
values (
  'onboarding-v1',
  'Vitahealth – Baseline Onboarding Vragenlijst',
  'active',
  $json$
  {
    "id": "vh-onboarding-v1",
    "title": "Vitahealth – Baseline Onboarding Vragenlijst",
    "status": "active",
    "questions": [
      { "id": "d1_leeftijd",    "type": "number",   "label": "Wat is je leeftijd?",      "category": "Algemene gegevens",   "min": 16,  "max": 100, "required": true },
      { "id": "d1_geslacht",    "type": "radio",    "label": "Geslacht",                 "category": "Algemene gegevens",   "required": true,
        "options": [
          { "value": "man",             "label": "Man" },
          { "value": "vrouw",           "label": "Vrouw" },
          { "value": "anders",          "label": "Anders" },
          { "value": "zeg_liever_niet", "label": "Zeg ik liever niet" }
        ]
      },
      { "id": "d1_lengte",      "type": "number",   "label": "Lengte (cm)",              "category": "Algemene gegevens",   "min": 100, "max": 250, "required": true },
      { "id": "d1_gewicht",     "type": "number",   "label": "Gewicht (kg)",             "category": "Algemene gegevens",   "min": 30,  "max": 300, "required": true },

      { "id": "d2_medicatie",   "type": "boolean",  "label": "Gebruik je momenteel medicatie?", "category": "Medische achtergrond", "required": true },
      { "id": "d2_medicatie_toelichting", "type": "short_text", "label": "Welke medicatie gebruik je?", "category": "Medische achtergrond", "required": false },
      { "id": "d2_diagnoses",   "type": "checkbox", "label": "Heb je momenteel één of meerdere medische diagnoses? (Meerdere antwoorden mogelijk)", "category": "Medische achtergrond", "required": true,
        "options": [
          { "value": "geen",        "label": "Geen" },
          { "value": "bloeddruk",   "label": "Hoge bloeddruk" },
          { "value": "diabetes",    "label": "Diabetes / verhoogde bloedsuiker" },
          { "value": "cholesterol", "label": "Hoog cholesterol" },
          { "value": "hart_vaat",   "label": "Hart- en vaatziekte" },
          { "value": "overgewicht", "label": "Overgewicht / obesitas" },
          { "value": "burnout",     "label": "Burn-out / stressgerelateerde klachten" },
          { "value": "depressie",   "label": "Depressie / angstklachten" },
          { "value": "slaap",       "label": "Slaapstoornis" },
          { "value": "darm",        "label": "Darmklachten" },
          { "value": "hormonaal",   "label": "Hormonale klachten" },
          { "value": "auto_immuun", "label": "Auto-immuunziekte" },
          { "value": "anders",      "label": "Anders" }
        ]
      },
      { "id": "d2_diagnoses_anders", "type": "short_text", "label": "Welke andere diagnose(s)?",               "category": "Medische achtergrond", "required": false },
      { "id": "d2_familie",     "type": "checkbox", "label": "Komen onderstaande aandoeningen voor in jouw directe familie? (Meerdere antwoorden mogelijk)", "category": "Medische achtergrond", "required": true,
        "options": [
          { "value": "diabetes",    "label": "Diabetes" },
          { "value": "hart_vaat",   "label": "Hart- en vaatziekten" },
          { "value": "bloeddruk",   "label": "Hoge bloeddruk" },
          { "value": "overgewicht", "label": "Overgewicht" },
          { "value": "dementie",    "label": "Dementie / Alzheimer" },
          { "value": "depressie",   "label": "Depressie / burn-out" },
          { "value": "kanker",      "label": "Kanker" },
          { "value": "geen",        "label": "Geen van bovenstaande" },
          { "value": "anders",      "label": "Anders" }
        ]
      },
      { "id": "d2_familie_anders",   "type": "short_text", "label": "Welke andere aandoening(en) in de familie?", "category": "Medische achtergrond", "required": false },

      { "id": "d3_bew_1",      "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik beweeg minimaal 30 minuten per dag.",                            "category": "Lifestyle — Beweging",                 "required": true },
      { "id": "d3_bew_2",      "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik sport of train regelmatig.",                                      "category": "Lifestyle — Beweging",                 "required": true },
      { "id": "d3_voed_1",     "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik eet dagelijks voldoende groenten en fruit.",                      "category": "Lifestyle — Voeding",                  "required": true },
      { "id": "d3_voed_2",     "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Mijn voedingspatroon voelt gezond en in balans.",                    "category": "Lifestyle — Voeding",                  "required": true },
      { "id": "d3_voed_3r",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik eet vaak uit stress, emotie of vermoeidheid.",                    "category": "Lifestyle — Voeding",                  "required": true },
      { "id": "d3_slaap_1",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik slaap over het algemeen goed.",                                   "category": "Lifestyle — Slaap & herstel",          "required": true },
      { "id": "d3_slaap_2",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik word meestal uitgerust wakker.",                                  "category": "Lifestyle — Slaap & herstel",          "required": true },
      { "id": "d3_stress_1r",  "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik ervaar veel stress in mijn dagelijks leven.",                     "category": "Lifestyle — Stress & mentale gezondheid", "required": true },
      { "id": "d3_stress_2",   "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik neem voldoende tijd voor ontspanning.",                           "category": "Lifestyle — Stress & mentale gezondheid", "required": true },
      { "id": "d3_stress_3",   "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik voel me mentaal veerkrachtig.",                                   "category": "Lifestyle — Stress & mentale gezondheid", "required": true },
      { "id": "d3_midd_1r",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik rook.",                                                            "category": "Lifestyle — Middelengebruik",           "required": true },
      { "id": "d3_midd_2r",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik drink meer alcohol dan goed voor me is.",                         "category": "Lifestyle — Middelengebruik",           "required": true },
      { "id": "d3_soc_1",      "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik voel me verbonden met andere mensen.",                            "category": "Lifestyle — Sociale gezondheid",        "required": true },
      { "id": "d3_soc_2",      "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik ervaar voldoende steun vanuit mijn omgeving.",                    "category": "Lifestyle — Sociale gezondheid",        "required": true },
      { "id": "d3_werk_1",     "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Mijn werk-privébalans voelt gezond.",                                "category": "Lifestyle — Werk & balans",             "required": true },
      { "id": "d3_werk_2",     "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik heb voldoende energie voor mijn dagelijkse activiteiten.",        "category": "Lifestyle — Werk & balans",             "required": true },
      { "id": "d3_regie_1",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik voel dat ik invloed heb op mijn gezondheid.",                     "category": "Lifestyle — Regie & motivatie",         "required": true },
      { "id": "d3_regie_2",    "type": "scale", "min": 1, "max": 5, "leftLabel": "Bijna nooit", "rightLabel": "Bijna altijd", "label": "Ik maak bewust keuzes die bijdragen aan mijn welzijn.",              "category": "Lifestyle — Regie & motivatie",         "required": true },

      { "id": "d4_energie",    "type": "rating_10", "label": "Hoe ervaar je jouw energieniveau op dit moment?",                                                                                       "category": "Klachten, energie en zelfzorg", "leftLabel": "Zeer laag",        "rightLabel": "Uitstekend",         "required": true },
      { "id": "d4_klachten",   "type": "rating_10", "label": "Hoeveel last ervaar je momenteel van lichamelijke klachten?",                                                                            "category": "Klachten, energie en zelfzorg", "leftLabel": "Geen last",        "rightLabel": "Veel last",          "required": true },
      { "id": "d4_gezondheid", "type": "radio",     "label": "Hoe zou je jouw algemene gezondheid beoordelen?",                                                                                        "category": "Klachten, energie en zelfzorg", "required": true,
        "options": [
          { "value": "1", "label": "Zeer slecht" },
          { "value": "2", "label": "Slecht" },
          { "value": "3", "label": "Redelijk" },
          { "value": "4", "label": "Goed" },
          { "value": "5", "label": "Zeer goed" }
        ]
      },
      { "id": "d4_zelfzorg_1", "type": "rating_10", "label": "Ik behandel mezelf met dezelfde vriendelijkheid als een goede vriend of vriendin.",                                                      "category": "Klachten, energie en zelfzorg", "leftLabel": "Helemaal niet", "rightLabel": "Volledig", "required": true },
      { "id": "d4_zelfzorg_2", "type": "rating_10", "label": "Ik neem voldoende tijd om voor mezelf te zorgen.",                                                                                       "category": "Klachten, energie en zelfzorg", "leftLabel": "Helemaal niet", "rightLabel": "Volledig", "required": true },
      { "id": "d4_zelfzorg_3", "type": "rating_10", "label": "Ik voel me waardevol, ook als ik niet presteer.",                                                                                        "category": "Klachten, energie en zelfzorg", "leftLabel": "Helemaal niet", "rightLabel": "Volledig", "required": true },
      { "id": "d4_patronen",   "type": "rating_10", "label": "Ik merk dat terugkerende patronen of overtuigingen mij soms belemmeren om keuzes te maken die goed zijn voor mijn gezondheid.",         "category": "Klachten, energie en zelfzorg", "leftLabel": "Helemaal niet", "rightLabel": "Volledig", "required": true },
      { "id": "d4_balans",     "type": "rating_10", "label": "Wanneer ik stress of tegenslag ervaar, weet ik meestal wat mij helpt om weer in balans te komen.",                                      "category": "Klachten, energie en zelfzorg", "leftLabel": "Helemaal niet", "rightLabel": "Volledig", "required": true },

      { "id": "d5_motivatie",  "type": "rating_10", "label": "Hoe gemotiveerd ben je om aan je gezondheid te werken?",                                                                                 "category": "Motivatie & doelen", "leftLabel": "Niet gemotiveerd",  "rightLabel": "Zeer gemotiveerd",   "required": true },
      { "id": "d5_vertrouwen", "type": "rating_10", "label": "Hoeveel vertrouwen heb je dat je duurzame veranderingen kunt volhouden?",                                                                "category": "Motivatie & doelen", "leftLabel": "Geen vertrouwen",   "rightLabel": "Volledig vertrouwen","required": true },
      { "id": "d5_doelen",     "type": "checkbox",  "label": "Wat is op dit moment jouw belangrijkste gezondheidsdoel? (Kies maximaal 3)",                                                             "category": "Motivatie & doelen", "required": true, "maxSelections": 3,
        "options": [
          { "value": "meer_energie",    "label": "Meer energie" },
          { "value": "betere_slaap",    "label": "Betere slaap" },
          { "value": "minder_stress",   "label": "Minder stress" },
          { "value": "afvallen",        "label": "Afvallen" },
          { "value": "betere_conditie", "label": "Betere conditie" },
          { "value": "spieropbouw",     "label": "Spieropbouw" },
          { "value": "concentratie",    "label": "Betere concentratie" },
          { "value": "minder_klachten", "label": "Minder lichamelijke klachten" },
          { "value": "hormoonbalans",   "label": "Betere hormoonbalans" },
          { "value": "gezonde_voeding", "label": "Gezondere voeding" },
          { "value": "preventief",      "label": "Preventief gezond blijven" },
          { "value": "mentale_balans",  "label": "Mentale balans" },
          { "value": "anders",          "label": "Anders" }
        ]
      },
      { "id": "d5_doelen_anders", "type": "short_text", "label": "Welk ander gezondheidsdoel?", "category": "Motivatie & doelen", "required": false }
    ]
  }
  $json$
)
on conflict (slug) do nothing;
