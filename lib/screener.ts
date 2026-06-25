// Vita Health — geschiktheidscheck (stap 4) uitsluitingscriteria.
// Eén bron van waarheid: gebruikt voor weergave in het formulier én voor
// vastlegging van de verklaring server-side (zodat de opgeslagen tekst exact
// overeenkomt met wat de deelnemer te zien kreeg).

// v2: bloedverdunners/antistolling verwijderd — volgens Nightingale geen
// uitsluiting (alleen praktische aandachtspunten bij de vingerprik).
export const SCREENER_VERSION = 2

export const SCREENER_INTRO =
  'De bloedafnamekit is niet voor iedereen geschikt. U kunt mogelijk niet deelnemen als u:'

export const SCREENER_CRITERIA: string[] = [
  'jonger bent dan 18 jaar;',
  'zwanger bent of borstvoeding geeft;',
  'een bloedingsstoornis heeft (zoals hemofilie of een vergelijkbare aandoening);',
  'bekend bent met ernstige bloedarmoede;',
  'in de afgelopen drie maanden een bloedtransfusie heeft gehad;',
  'in de afgelopen drie maanden een operatie heeft ondergaan;',
  'op het moment van afname koorts of een actieve infectie heeft;',
  'twijfelt of vingerprikafname voor u veilig is.',
]

// Verklaring van de deelnemer
export type ScreenerDeclaration = 'niet_van_toepassing' | 'mogelijk_van_toepassing'

export const SCREENER_DECLARATION_LABEL: Record<ScreenerDeclaration, string> = {
  niet_van_toepassing:    'Geen van de criteria is op mij van toepassing',
  mogelijk_van_toepassing:'Mogelijk is één van de criteria op mij van toepassing',
}
