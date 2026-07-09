<?php
/**
 * Gedeelde verzendlaag voor de website-formulieren: verstuurt via de Resend-API
 * (betrouwbaarder dan PHP mail() op gedeelde hosting).
 *
 * De API-key + afzender/ontvanger staan in een configbestand BUITEN de webroot,
 * zodat de key niet publiek uitleesbaar is. Verwacht: één map boven /www een
 * bestand `resend-config.php` dat een array teruggeeft:
 *
 *   <?php return [
 *     'api_key' => 're_xxxxxxxxxxxxxxxxxxxxxxxx',
 *     'from'    => 'Vita Health Website <noreply@vita-health.nl>', // Resend-geverifieerd
 *     'to'      => 'info@vita-health.nl',
 *   ];
 *
 * Als alternatief kunnen de waarden ook uit omgevingsvariabelen komen
 * (RESEND_API_KEY / RESEND_FROM / RESEND_TO).
 */

function vh_resend_config() {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  $cfg = [
    'api_key' => getenv('RESEND_API_KEY') ?: '',
    'from'    => getenv('RESEND_FROM') ?: 'Vita Health Website <noreply@vita-health.nl>',
    'to'      => getenv('RESEND_TO')   ?: 'info@vita-health.nl',
  ];

  // Config buiten de webroot heeft voorrang.
  $file = __DIR__ . '/../resend-config.php';
  if (is_file($file)) {
    $loaded = require $file;
    if (is_array($loaded)) {
      foreach (['api_key', 'from', 'to'] as $k) {
        if (!empty($loaded[$k])) $cfg[$k] = $loaded[$k];
      }
    }
  }
  return $cfg;
}

/**
 * Verstuurt een platte-tekst-mail naar het geconfigureerde ontvangeradres.
 * $replyTo = het e-mailadres van de indiener (zodat je direct kunt antwoorden).
 * Retourneert [bool $ok, ?string $error].
 */
function vh_resend_send($subject, $text, $replyTo) {
  $cfg = vh_resend_config();
  if (empty($cfg['api_key'])) {
    return [false, 'Mailservice is niet geconfigureerd (API-key ontbreekt).'];
  }

  $payload = json_encode([
    'from'     => $cfg['from'],
    'to'       => [$cfg['to']],
    'reply_to' => $replyTo,
    'subject'  => $subject,
    'text'     => $text,
  ]);

  $ch = curl_init('https://api.resend.com/emails');
  curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . $cfg['api_key'],
      'Content-Type: application/json',
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
  ]);
  $resp = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);

  if ($resp === false) return [false, 'Verbinding met de mailservice mislukt: ' . $err];
  if ($code >= 200 && $code < 300) return [true, null];
  error_log('[resend] status ' . $code . ': ' . substr((string)$resp, 0, 300));
  return [false, 'Mailservice gaf een fout (status ' . $code . ').'];
}
