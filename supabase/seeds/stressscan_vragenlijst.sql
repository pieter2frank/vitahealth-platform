-- Vita Health — Stressscan vragenlijst seed
-- Uitvoeren via: Supabase Dashboard → SQL Editor
-- Idempotent: bestaande rij wordt bijgewerkt bij heruitvoeren

insert into vh_questionnaire (slug, title, status, json_content)
values (
  'stressscan-v1',
  'Vita Health Stressscan',
  'active',
  $json$
  {
    "id": "vh-stressscan-v1",
    "title": "Vita Health Stressscan",
    "status": "active",
    "questions": [

      {
        "id": "st1_gespannen",
        "type": "radio",
        "label": "Hoe vaak voel je je gespannen of opgejaagd?",
        "category": "Stressbeleving",
        "required": true,
        "options": [
          { "value": "nooit",       "label": "Nooit" },
          { "value": "soms",        "label": "Soms" },
          { "value": "regelmatig",  "label": "Regelmatig" },
          { "value": "vaak",        "label": "Vaak" },
          { "value": "bijna_altijd","label": "Bijna altijd" }
        ]
      },

      {
        "id": "st2_controle",
        "type": "radio",
        "label": "Heb je het gevoel dat je voldoende controle hebt over belangrijke zaken in je leven?",
        "category": "Stressbeleving",
        "required": true,
        "options": [
          { "value": "altijd",     "label": "Altijd" },
          { "value": "vaak",       "label": "Vaak" },
          { "value": "regelmatig", "label": "Regelmatig" },
          { "value": "zelden",     "label": "Zelden" },
          { "value": "nooit",      "label": "Nooit" }
        ]
      },

      {
        "id": "st3_signalen",
        "type": "checkbox",
        "label": "Welke lichamelijke signalen van stress herken je?",
        "category": "Lichamelijke signalen",
        "required": true,
        "options": [
          { "value": "schouders",         "label": "Gespannen schouders" },
          { "value": "hoofdpijn",         "label": "Hoofdpijn" },
          { "value": "vermoeidheid",      "label": "Vermoeidheid" },
          { "value": "hartkloppingen",    "label": "Hartkloppingen" },
          { "value": "darmklachten",      "label": "Darmklachten" },
          { "value": "slechte_slaap",     "label": "Slechte slaap" },
          { "value": "concentratie",      "label": "Concentratieproblemen" },
          { "value": "geen",              "label": "Geen" }
        ]
      },

      {
        "id": "st4_oorzaak",
        "type": "radio",
        "label": "Welke situatie veroorzaakt momenteel de meeste stress?",
        "category": "Stressoorzaken",
        "required": true,
        "options": [
          { "value": "werk",        "label": "Werk" },
          { "value": "relatie",     "label": "Relatie/gezin" },
          { "value": "mantelzorg",  "label": "Mantelzorg" },
          { "value": "gezondheid",  "label": "Gezondheid" },
          { "value": "financieel",  "label": "Financieel" },
          { "value": "onzekerheid", "label": "Onzekerheid over de toekomst" },
          { "value": "anders",      "label": "Anders" }
        ]
      },

      {
        "id": "st5_herstel",
        "type": "radio",
        "label": "Hoe goed lukt het je om te herstellen na een drukke dag?",
        "category": "Herstel & ontspanning",
        "required": true,
        "options": [
          { "value": "zeer_slecht", "label": "Zeer slecht" },
          { "value": "slecht",      "label": "Slecht" },
          { "value": "redelijk",    "label": "Redelijk" },
          { "value": "goed",        "label": "Goed" },
          { "value": "zeer_goed",   "label": "Zeer goed" }
        ]
      },

      {
        "id": "st6_rust",
        "type": "radio",
        "label": "Welke uitspraak past het beste bij jou?",
        "category": "Herstel & ontspanning",
        "required": true,
        "options": [
          { "value": "genoeg_rust",    "label": "Ik neem voldoende rustmomenten" },
          { "value": "weet_niet",      "label": "Ik weet dat ik rust nodig heb maar neem die onvoldoende" },
          { "value": "lastig",         "label": "Ik vind het lastig om te ontspannen" },
          { "value": "overbelast",     "label": "Ik voel me structureel overbelast" }
        ]
      },

      {
        "id": "st7_zelfvriendelijkheid",
        "type": "radio",
        "label": "Hoe vriendelijk ben je voor jezelf wanneer iets niet lukt?",
        "category": "Zelfcompassie",
        "required": true,
        "options": [
          { "value": "zeer_vriendelijk", "label": "Zeer vriendelijk" },
          { "value": "vriendelijk",      "label": "Redelijk vriendelijk" },
          { "value": "neutraal",         "label": "Neutraal" },
          { "value": "kritisch",         "label": "Kritisch" },
          { "value": "zeer_kritisch",    "label": "Zeer kritisch" }
        ]
      },

      {
        "id": "st8_overtuiging",
        "type": "radio",
        "label": "Welke overtuiging herken je het meest?",
        "category": "Zelfcompassie",
        "required": true,
        "options": [
          { "value": "sterk",           "label": "Ik moet sterk zijn" },
          { "value": "zelf_oplossen",   "label": "Ik moet het zelf oplossen" },
          { "value": "teleurstellen",   "label": "Ik mag anderen niet teleurstellen" },
          { "value": "presteren",       "label": "Ik moet presteren" },
          { "value": "geen",            "label": "Ik herken geen van bovenstaande" }
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
