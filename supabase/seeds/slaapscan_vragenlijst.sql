-- Vita Health — Slaapscan vragenlijst seed
-- Uitvoeren via: Supabase Dashboard → SQL Editor
-- Idempotent: doet niets als de slug al bestaat

insert into vh_questionnaire (slug, title, status, json_content)
values (
  'slaapscan-v1',
  'Vita Health Slaapscan',
  'active',
  $json$
  {
    "id": "vh-slaapscan-v1",
    "title": "Vita Health Slaapscan",
    "status": "active",
    "questions": [

      {
        "id": "s1_slaapuur",
        "type": "radio",
        "label": "Hoeveel uur slaap je gemiddeld per nacht?",
        "category": "Slaappatroon",
        "required": true,
        "options": [
          { "value": "lt5",  "label": "Minder dan 5 uur" },
          { "value": "5_6",  "label": "5–6 uur" },
          { "value": "6_7",  "label": "6–7 uur" },
          { "value": "7_8",  "label": "7–8 uur" },
          { "value": "gt8",  "label": "Meer dan 8 uur" }
        ]
      },

      {
        "id": "s2_inslaapduur",
        "type": "radio",
        "label": "Hoe lang duurt het meestal voordat je in slaap valt?",
        "category": "Slaappatroon",
        "required": true,
        "options": [
          { "value": "lt15",  "label": "Minder dan 15 minuten" },
          { "value": "15_30", "label": "15–30 minuten" },
          { "value": "30_60", "label": "30–60 minuten" },
          { "value": "gt60",  "label": "Meer dan 60 minuten" }
        ]
      },

      {
        "id": "s3_wakker",
        "type": "radio",
        "label": "Hoe vaak word je 's nachts wakker?",
        "category": "Slaappatroon",
        "required": true,
        "options": [
          { "value": "nooit",  "label": "Nooit" },
          { "value": "1x",     "label": "1 keer" },
          { "value": "2_3x",   "label": "2–3 keer" },
          { "value": "gt3x",   "label": "Meer dan 3 keer" }
        ]
      },

      {
        "id": "s4_uitgerust",
        "type": "radio",
        "label": "Hoe vaak voel je je uitgerust bij het opstaan?",
        "category": "Slaapkwaliteit",
        "required": true,
        "options": [
          { "value": "nooit",      "label": "Nooit" },
          { "value": "soms",       "label": "Soms" },
          { "value": "regelmatig", "label": "Regelmatig" },
          { "value": "vaak",       "label": "Vaak" },
          { "value": "altijd",     "label": "Altijd" }
        ]
      },

      {
        "id": "s5_problemen",
        "type": "checkbox",
        "label": "Heb je last van één of meer van onderstaande problemen?",
        "category": "Slaapkwaliteit",
        "required": true,
        "options": [
          { "value": "piekeren",       "label": "Piekeren" },
          { "value": "stress",         "label": "Stress" },
          { "value": "nachtelijk",     "label": "Nachtelijk wakker worden" },
          { "value": "pijn",           "label": "Pijnklachten" },
          { "value": "snurken",        "label": "Snurken" },
          { "value": "benauwdheid",    "label": "Benauwdheid" },
          { "value": "opvliegers",     "label": "Opvliegers" },
          { "value": "toilet",         "label": "Toiletbezoek" },
          { "value": "geen",           "label": "Geen van bovenstaande" }
        ]
      },

      {
        "id": "s6_scherm",
        "type": "radio",
        "label": "Hoe vaak gebruik je het laatste uur voor het slapen je telefoon, tablet, laptop of tv?",
        "category": "Schermgebruik voor het slapen",
        "required": true,
        "options": [
          { "value": "nooit",      "label": "Nooit" },
          { "value": "soms",       "label": "Soms" },
          { "value": "regelmatig", "label": "Regelmatig" },
          { "value": "vaak",       "label": "Vaak" }
        ]
      },

      {
        "id": "s7_cafeine",
        "type": "radio",
        "label": "Hoeveel cafeïne gebruik je gemiddeld na 14:00 uur?",
        "category": "Leefstijl",
        "required": true,
        "options": [
          { "value": "geen",  "label": "Geen" },
          { "value": "1x",    "label": "1 consumptie" },
          { "value": "2x",    "label": "2 consumpties" },
          { "value": "gt3x",  "label": "3 of meer" }
        ]
      },

      {
        "id": "s8_beoordeling",
        "type": "radio",
        "label": "Welke uitspraak past het beste bij jou?",
        "category": "Algemene beoordeling",
        "required": true,
        "options": [
          { "value": "geen_probleem",    "label": "Mijn slaap is geen probleem" },
          { "value": "kan_beter",        "label": "Mijn slaap kan beter" },
          { "value": "energie",          "label": "Mijn slaap beïnvloedt mijn energie" },
          { "value": "functioneren",     "label": "Mijn slaap beïnvloedt mijn dagelijks functioneren aanzienlijk" }
        ]
      }

    ]
  }
  $json$
)
on conflict (slug) do update set
  title        = excluded.title,
  json_content = excluded.json_content,
  status       = excluded.status;
