# Modelkeuze AI-adviesgeneratie — beslisnotitie

| | |
|---|---|
| **Versie** | 1.0 |
| **Datum** | 20 augustus 2026 |
| **Besluit** | `Qwen/Qwen3-235B-A22B-Instruct-2507` (Nebius Token Factory, regio eu-north1) als productiemodel voor de adviesgeneratie |
| **Herziening** | Na het vullen van de kennisbank (slaap/stress/zelfzorg), of bij de jaarlijkse leveranciersbeoordeling (aug 2027) |

## Context

De AI-advieslaag genereert concept-leefstijladviezen (RAG op de eigen kennisbank,
deterministische top 3-prioritering, arts beoordeelt vóór verzending). De modelkeuze is
gemaakt met de interne AI-eval: identieke context per model, beoordeeld door een
rubric-beoordelaar (structuur, bronnen, top 3, concreetheid, veiligheid; 1–5) met het
arts-advies als referentie, op drie vaste geannoteerde casussen.

## Vergeleken modellen

| Model | Regio | Rubric (gem.) | Tijd/advies | Prijs in/uit per 1M tokens |
|---|---|---|---|---|
| **Qwen3-235B-A22B-Instruct-2507** ✔ | eu-north1 (EU) | ≈ 4,2–4,3 | ± 45 s | $0,20 / $0,60 |
| DeepSeek-V4-Pro | uk-south1 (VK) | ≈ 4,7 | ± 3,5 min | $1,75 / $3,50 |
| Claude Opus 4.8 (referentie, alleen eval) | VS | ≈ 4,5 | ± 40 s | n.v.t. |
| Llama-3.3-70B-Instruct (vorig model) | EU | ≈ 3,7 (oude prompt) | 100–220 s | — |
| Kimi-K3 | eu-west2 | afgevallen | — | denk-model: leeg antwoord |
| DeepSeek-V4-Flash | us-central1 | afgevallen | — | VS-hosting + reasoning-model |

## Afwegingen

1. **AVG/hosting:** eu-north1 valt binnen het gedocumenteerde kader ("verwerking binnen
   de EU"; zie privacyverklaring, verwerkingsregister en de Nebius-vaststelling).
   DeepSeek-V4-Pro (VK) zou juridisch kunnen op grond van het vernieuwde
   adequaatheidsbesluit EU–VK (19-12-2025, geldig t/m 27-12-2031), maar vergt aanpassing
   van het dossier; VS-modellen vallen af.
2. **Kwaliteit:** het verschil met DeepSeek-V4-Pro (± 0,3–0,4 punt) zit vrijwel geheel in
   "concreetheid" en hangt samen met de nog dun gevulde kennisbank — de verwachte
   verbetering daarvan komt alle modellen ten goede. Hermeting na kennisbankvulling.
3. **Snelheid:** ± 45 s versus ± 3,5 min per advies; relevant voor de arts-workflow.
4. **Kosten:** beide verwaarloosbaar per advies (± $0,003 vs ± $0,02); geen factor.
5. **Zero Data Retention** blijft op organisatieniveau van kracht (org Zorg.nl-8fk);
   geen opslag van prompts/uitvoer na verwerking, geen training op klantdata.

## Randvoorwaarden bij modelwissel (blijvend beleid)

- Alleen niet-denkende instruct-modellen (denk-modellen geven lege/afgekapte adviezen).
- Verwerkingslocatie per model controleren (EU, of gedocumenteerde uitzondering).
- Embeddingmodel (`Qwen3-Embedding-8B`, 1024 dim) wijzigt niet mee — wisselen daarvan
  vereist volledige herindexering van de kennisbank.
- Elke wissel eerst langs de AI-eval op de vaste casussen; rubric-scores bewaren in
  deze notitie of een opvolger.
