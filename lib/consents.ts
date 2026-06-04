// Vita Health — toestemmingsteksten (gedeeld tussen portaal en e-mailservice)

export const REQUIRED_CONSENTS = [
  // 1. Geïnformeerde toestemming (WGBO) + vrijwilligheid
  'Ik heb de deelnemersinformatie gelezen en begrepen, heb voldoende gelegenheid gehad om vragen te stellen, begrijp dat deelname volledig vrijwillig is en dat ik mijn deelname op elk moment zonder opgave van reden kan beëindigen.',

  // 2. Toestemming gegevensverwerking (AVG art. 9 — bijzondere persoonsgegevens)
  'Ik geef uitdrukkelijk toestemming voor het verwerken van mijn persoonsgegevens en gezondheidsgegevens door Vita Health, het delen van mijn gegevens en samplecode met Nightingale Health voor laboratoriumanalyse, en de ontvangst en beoordeling van mijn resultaten door Vita Health en een medisch deskundige.',

  // 3. Deelnameverklaring + communicatie
  'Ik verklaar de gezondheidsvragenlijst volledig en naar waarheid in te vullen en stem in dat Vita Health contact met mij opneemt over mijn deelname, de sample-afname, mijn uitslag en eventuele vervolgstappen.',

  // 4. Medische disclaimer (aansprakelijkheidsbeperking)
  'Ik begrijp dat de biomarkertest geen medische diagnose stelt en geen vervanging is van reguliere medische zorg. Bij gezondheidsklachten raadpleeg ik altijd mijn huisarts of, bij spoed, de huisartsenpost of 112.',
] as const

export const OPTIONAL_CONSENTS = [
  'Ik geef toestemming dat mijn niet-herleidbare feedback en procesgegevens worden gebruikt om het proces te verbeteren voor een grotere pilot.',
  'Ik geef toestemming dat Vita Health mij na afloop benadert voor feedback over mijn ervaring met de biomarkertest.',
  'Ik geef toestemming dat mijn gegevens, uitsluitend in gepseudonimiseerde of geaggregeerde vorm, worden gebruikt voor evaluatie van de dry-run.',
] as const
