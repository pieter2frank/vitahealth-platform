# Vaststellingen verwerkersovereenkomsten (DPA's)

Veel leveranciers sluiten de verwerkersovereenkomst niet met een handtekening, maar als
**automatisch onderdeel van hun algemene voorwaarden** ("incorporation by reference").
Dat voldoet aan AVG art. 28 (schriftelijk, waaronder elektronische vorm). Dit bestand
legt per partij vast **dat, hoe en welke versie** van toepassing is — samen met de
opgeslagen PDF is dat de aantoonbaarheid voor het dossier.

Werkwijze per partij: DPA-tekst als PDF opslaan in deze map, subverwerkerslijst als PDF
erbij, en hieronder een regel invullen.

| Partij | Totstandkoming | Versie / datum DPA | Vastgesteld op | PDF in map | Subverwerkers-PDF |
|---|---|---|---|---|---|
| Supabase | Automatisch — DPA "forms part of the Supabase Terms of Service" (geaccepteerd bij accountaanmaak) | Version 1 — August 1, 2026 | 18-08-2026 | ✔ `dpa-supabase-v1-aug2026.pdf` + TIA (`Supabase+TIA+250314.pdf`) | ☐ |
| Zivver | Standaard-DPA van zivver.com/legal/data-processing (gekoppeld aan de hoofdovereenkomst; desgewenst bevestiging vragen bij accountbeheer) | zie PDF | 18-08-2026 | ✔ `dpa-zivver.pdf` | ☐ |
| TransIP | Self-serve afgesloten via het TransIP-controlepaneel (op naam van accounthouder) | VO v8 + subverwerkersovereenkomst v6 | 18-08-2026 | ✔ `vo-transip-v8.pdf` + `svo-transip-v6.pdf` | ✔ (svo) |
| Resend | **Ondertekende DPA** (self-serve via resend.com/legal/dpa), incl. SCC's voor VS-doorgifte. Extra assurance in map: SOC 2 Type II-rapport + pentest-attestatie | zie PDF | 18-08-2026 | ✔ `resend-dpa-signed.pdf` (+ `resend-soc-2-type-ii-report.pdf`, `resend-pen-test-letter-of-attestation.pdf`) | ☐ subverwerkerslijst (AWS e.a.) nog opslaan — check DPA-annex of resend.com |
| Better Stack | _in te vullen_ | | | ☐ | ☐ |
| Nebius (Token Factory) | Self-serve: DPA op docs.tokenfactory.nebius.com/legal/dpa (Nebius B.V., NL-recht; DPA voorziet expliciet in art. 9-gezondheidsdata, Annex 1(B)). Geen training op klantdata (Legal Quick Guide §4.2). **Zero Data Retention AAN sinds 18-08-2026** (org Zorg.nl-8fk); schriftelijke ZDR-bevestiging desgewenst via support | zie PDF | 18-08-2026 | ✔ `dpa-nebius.pdf` | ✔ `subverwerkers-nebius.pdf` |
| Nightingale Health | _in te vullen (via labcontract — ondertekend document)_ | | | ☐ | ☐ |

**Geen DPA (zelfstandig verwerkingsverantwoordelijke):** Mollie (betaalinstelling) en
PostNL (vervoerder) — rolduiding vastleggen in het verwerkingsregister, niet hier.

_Jaarlijkse check (zie jaarplanning): kloppen de versies nog en zijn er nieuwe
subverwerkers aangekondigd?_
