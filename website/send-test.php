<?php
/**
 * Verwerkt het interesse-formulier ("Ik wil een test") en mailt de gegevens
 * naar Vita Health. Eenvoudige PHP-mail() — werkt op standaard PHP-hosting.
 *
 * Pas zo nodig $TO en $FROM aan (FROM moet een adres op je eigen domein zijn
 * i.v.m. SPF/deliverability).
 */

$TO      = 'info@vita-health.nl';
$FROM    = 'noreply@vita-health.nl';
$SUBJECT = 'Interesse in biomarkertest Vita Health';

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
    $kop = $ok ? 'Bedankt voor je interesse' : 'Er ging iets mis';
    echo "<!DOCTYPE html><html lang=\"nl\"><head><meta charset=\"utf-8\">"
       . "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">"
       . "<title>$kop — Vita Health</title>"
       . "<style>body{font-family:system-ui,sans-serif;background:#f6f7fb;color:#1e293b;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:1.5rem}"
       . ".box{background:#fff;border:1px solid #e6e9f2;border-radius:16px;padding:2rem 2.2rem;max-width:30rem;text-align:center;box-shadow:0 10px 30px rgba(31,22,131,.08)}"
       . "h1{color:#1f1683;font-size:1.3rem;margin:0 0 .6rem}a{color:#1f1683}</style></head><body><div class=\"box\">"
       . "<h1>" . htmlspecialchars($kop) . "</h1><p>" . htmlspecialchars($message) . "</p>"
       . "<p><a href=\"test.html\">← Terug naar de website</a></p></div></body></html>";
  }
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  respond(false, 'Methode niet toegestaan.', $isAjax, 405);
}

// Honeypot
if (!empty($_POST['website'])) {
  respond(true, 'Bedankt voor je interesse!', $isAjax);
}

$voornaam   = strip_nl($_POST['voornaam']   ?? '');
$achternaam = strip_nl($_POST['achternaam'] ?? '');
$email      = strip_nl($_POST['email']      ?? '');
$telefoon   = strip_nl($_POST['telefoon']   ?? '');
$type       = strip_nl($_POST['type']       ?? '');
$akkoord    = !empty($_POST['akkoord']);
$toelichting = trim((string)($_POST['toelichting'] ?? ''));

if ($voornaam === '' || $achternaam === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(false, 'Vul je naam en een geldig e-mailadres in.', $isAjax, 422);
}

$body =
  "Nieuwe interesse in een biomarkertest via de website\n" .
  "====================================================\n\n" .
  "Naam:        $voornaam $achternaam\n" .
  "E-mail:      $email\n" .
  "Telefoon:    " . ($telefoon !== '' ? $telefoon : '-') . "\n" .
  "Aanvraag als: " . ($type !== '' ? $type : '-') . "\n" .
  "Akkoord AVG: " . ($akkoord ? 'Ja' : 'Nee') . "\n\n" .
  "Toelichting:\n" . ($toelichting !== '' ? $toelichting : '-') . "\n\n" .
  "----------------------------------------\n" .
  "Verzonden:   " . date('d-m-Y H:i') . "\n";

$headers  = "From: Vita Health Website <$FROM>\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$ok = @mail($TO, $SUBJECT, $body, $headers);

if ($ok) {
  respond(true, 'We nemen zo snel mogelijk contact met u op over de vervolgstappen.', $isAjax);
} else {
  respond(false, 'Versturen is helaas mislukt. Mail ons rechtstreeks op info@vita-health.nl.', $isAjax, 500);
}
