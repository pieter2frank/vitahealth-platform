<?php
/**
 * Verwerkt het contactformulier en mailt de gegevens naar Vita Health.
 * Eenvoudige PHP-mail() — werkt op standaard PHP-hosting.
 *
 * Pas zo nodig $TO en $FROM aan (FROM moet een adres op je eigen domein zijn
 * i.v.m. SPF/deliverability).
 */

$TO      = 'info@vita-health.nl';
$FROM    = 'noreply@vita-health.nl';
$SUBJECT = 'Informatieverzoek website Vita Health';

// ── Helpers ──────────────────────────────────────────────────────────────────
$isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH'])
  && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

function strip_nl($v) { return trim(str_replace(["\r", "\n", "\t"], ' ', (string)$v)); }

function respond($ok, $message, $isAjax, $code = 200) {
  http_response_code($code);
  if ($isAjax) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => $ok, 'error' => $ok ? null : $message]);
  } else {
    header('Content-Type: text/html; charset=utf-8');
    $kop = $ok ? 'Bedankt voor je bericht' : 'Er ging iets mis';
    echo "<!DOCTYPE html><html lang=\"nl\"><head><meta charset=\"utf-8\">"
       . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
       . "<title>$kop — Vita Health</title>"
       . "<style>body{font-family:system-ui,sans-serif;background:#f6f7fb;color:#1e293b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1.5rem}"
       . ".box{background:#fff;border:1px solid #e6e9f2;border-radius:16px;padding:2rem 2.2rem;max-width:30rem;text-align:center;box-shadow:0 10px 30px rgba(31,22,131,.08)}"
       . "h1{color:#1f1683;font-size:1.3rem;margin:0 0 .6rem}a{color:#1f1683}</style></head><body><div class=\"box\">"
       . "<h1>" . htmlspecialchars($kop) . "</h1><p>" . htmlspecialchars($message) . "</p>"
       . "<p><a href=\"contact.html\">← Terug naar de website</a></p></div></body></html>";
  }
  exit;
}

// ── Alleen POST ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  respond(false, 'Methode niet toegestaan.', $isAjax, 405);
}

// ── Honeypot: bots vullen het verborgen veld 'website' ───────────────────────
if (!empty($_POST['website'])) {
  respond(true, 'Bedankt voor je bericht!', $isAjax); // stil negeren
}

// ── Velden ───────────────────────────────────────────────────────────────────
$voornaam   = strip_nl($_POST['voornaam']   ?? '');
$achternaam = strip_nl($_POST['achternaam'] ?? '');
$email      = strip_nl($_POST['email']      ?? '');
$telefoon   = strip_nl($_POST['telefoon']   ?? '');
$onderwerp  = strip_nl($_POST['onderwerp']  ?? '');
$bericht    = trim((string)($_POST['bericht'] ?? ''));

// ── Validatie ────────────────────────────────────────────────────────────────
if ($voornaam === '' || $achternaam === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $bericht === '') {
  respond(false, 'Vul je naam, een geldig e-mailadres en een bericht in.', $isAjax, 422);
}

// ── Spamfilter (bot-spam met links/marketing, omzeilt de honeypot) ───────────
require __DIR__ . '/spam-filter.php';
if (vh_is_spam([$voornaam, $achternaam, $bericht], $email) || vh_bad_origin('vita-health.nl')) {
  respond(true, 'Bedankt voor je bericht!', $isAjax); // stil negeren
}

// ── E-mail opbouwen (gegevens overzichtelijk onder elkaar) ───────────────────
$body =
  "Nieuw informatieverzoek via de website\n" .
  "======================================\n\n" .
  "Naam:       $voornaam $achternaam\n" .
  "E-mail:     $email\n" .
  "Telefoon:   " . ($telefoon !== '' ? $telefoon : '-') . "\n" .
  "Ik ben:     " . ($onderwerp !== '' ? $onderwerp : '-') . "\n\n" .
  "Bericht:\n" . $bericht . "\n\n" .
  "----------------------------------------\n" .
  "Verzonden:  " . date('d-m-Y H:i') . "\n";

// Versturen via Resend (i.p.v. PHP mail()). Antwoorden gaan naar de indiener.
require __DIR__ . '/resend-mailer.php';
list($ok, $err) = vh_resend_send($SUBJECT, $body, $email);

if ($ok) {
  respond(true, 'We nemen zo snel mogelijk contact met u op.', $isAjax);
} else {
  respond(false, $err ?: 'Versturen is helaas mislukt. Mail ons rechtstreeks op info@vita-health.nl.', $isAjax, 500);
}
