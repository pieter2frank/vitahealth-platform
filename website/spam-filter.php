<?php
/**
 * Eenvoudige, afhankelijkheidsvrije spamdetectie voor de website-formulieren.
 * Vangt de veelvoorkomende bot-spam (o.a. "Eric Jones / Web Visitors Into Leads")
 * die rechtstreeks naar het endpoint POST en zo de honeypot omzeilt.
 *
 * Gebruik:
 *   require __DIR__ . '/spam-filter.php';
 *   if (vh_is_spam([$voornaam, $achternaam, $bericht], $email)
 *       || vh_bad_origin('vita-health.nl')) {
 *     // stil negeren (net als de honeypot) — bot denkt dat het gelukt is
 *   }
 */

// Bevat de tekst een URL / linkpatroon? Legitieme interesse-aanvragen voor een
// biomarkertest bevatten vrijwel nooit links; bot-spam vrijwel altijd. (.nl is
// bewust uitgesloten zodat iemand die "vita-health.nl" noemt niet wordt geblokt.)
function vh_contains_url($text) {
  return (bool) preg_match(
    '~(https?://|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|biz|info|online|site|shop|aspx)\b)~i',
    (string) $text
  );
}

/**
 * @param string[] $texts  Vrije-tekstvelden (naam, bericht, toelichting).
 * @param string   $email  E-mailadres (alleen voor keyword-scan, niet voor URL-scan).
 * @return bool True als het bericht als spam wordt beschouwd.
 */
function vh_is_spam(array $texts, $email = '') {
  // 1. Links in de vrije tekst → vrijwel altijd spam.
  foreach ($texts as $t) {
    if (vh_contains_url($t)) return true;
  }

  // 2. Bekende bot-marketingtermen (meerwoords → verwaarloosbaar risico op false positives).
  $blob = strtolower(implode(' ', $texts) . ' ' . $email);
  $keywords = [
    'web visitors', 'into leads', 'lead generation', 'blastlead',
    'backlink', 'search engine', 'digital marketing', 'more traffic',
    'rank your', 'unsubscribe.aspx', 'cryptocurrency', 'bitcoin',
    'website owner', 'nl owner', 'sms text with lead', 'talk to that lead',
    'betting you', 'grow your business', 'affordable seo',
  ];
  foreach ($keywords as $kw) {
    if (strpos($blob, $kw) !== false) return true;
  }

  return false;
}

/**
 * True als de POST aantoonbaar NIET van je eigen domein komt. Ontbreekt de
 * Origin/Referer-header volledig, dan blokkeren we hier niet op (sommige
 * privacybrowsers laten 'm weg) — dan doet de inhoudsfilter het werk.
 */
function vh_bad_origin($allowed_host) {
  $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
  if ($src === '') return false;
  $host = parse_url($src, PHP_URL_HOST);
  if (!$host) return false;
  return stripos($host, $allowed_host) === false;
}
