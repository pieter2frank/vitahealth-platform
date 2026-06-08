// Vita Health — e-mailtemplates
// Alle templates retourneren { subject, html } — inzetbaar in elke SMTP/API provider.

const YEAR = new Date().getFullYear()

/** Escapet HTML-tekens in gebruikersdata zodat XSS via e-mail onmogelijk is. */
function esc(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:40px auto 60px;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 1px 3px rgba(0,0,0,.06);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1f1683 0%,#3b55c8 100%);padding:32px 36px 28px;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,.65);">Vita Health</p>
      <h1 style="margin:0;font-size:22px;font-weight:700;color:white;line-height:1.3;">${title}</h1>
    </div>

    <!-- Accent lijn -->
    <div style="height:3px;background:linear-gradient(90deg,#17e4a1,#04b788);"></div>

    <!-- Inhoud -->
    <div style="padding:32px 36px;">${body}</div>

    <!-- Footer -->
    <div style="border-top:1px solid #f1f5f9;padding:20px 36px;text-align:center;background:#f8fafc;">
      <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">
        © ${YEAR} Vita Health &nbsp;·&nbsp;
        <a href="https://helpdesk.vita-health.nl" style="color:#94a3b8;text-decoration:none;">helpdesk.vita-health.nl</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

function btn(href: string, label: string): string {
  // Alleen https-URLs toestaan — blokkeer javascript:, data: en andere schema's
  const safeHref = href.startsWith('https://') || href.startsWith('http://')
    ? esc(href)
    : '#'
  return `<div style="text-align:center;margin:28px 0 24px;">
    <a href="${safeHref}" style="display:inline-block;background:linear-gradient(135deg,#1f1683,#3b55c8);color:white;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:.3px;">
      ${label} →
    </a>
  </div>`
}

function p(text: string, style = ''): string {
  return `<p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.65;${style}">${text}</p>`
}

function greeting(firstName: string): string {
  return `<p style="margin:0 0 20px;color:#1e293b;font-size:15px;font-weight:600;">Beste ${esc(firstName)},</p>`
}

// ─── 1. Uitnodiging ───────────────────────────────────────────────────────────

export function uitnodigingEmail(opts: {
  firstName: string
  intakeUrl: string
  appUrl: string
}): { subject: string; html: string } {
  const deelnemersinfoUrl  = `${opts.appUrl}/deelnemersinformatie-vita-health.pdf`
  const privacyverklaringUrl = `${opts.appUrl}/privacyverklaring-vita-health.pdf`

  const body = `
    ${greeting(opts.firstName)}
    ${p('Je bent uitgenodigd om deel te nemen aan de <strong style="color:#1e293b;">Vita Health Check</strong>. Hieronder lees je kort hoe het proces verloopt. Lees voor aanvang de onderstaande documenten zorgvuldig door.')}

    <!-- Procesoverzicht -->
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin:0 0 20px;">
      <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#1e293b;">Zo werkt de Vita Health Check</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:30px;vertical-align:top;padding-bottom:14px;">
            <div style="width:24px;height:24px;background:#1f1683;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#ffffff;">1</div>
          </td>
          <td style="padding-bottom:14px;padding-left:12px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#1e293b;">Aanmelden &amp; intake</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Je vult je gegevens, toestemmingen en de gezondheidsvragenlijst in. Vita Health beoordeelt vervolgens of de test geschikt voor je is.</p>
          </td>
        </tr>
        <tr>
          <td style="width:30px;vertical-align:top;padding-bottom:14px;">
            <div style="width:24px;height:24px;background:#1f1683;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#ffffff;">2</div>
          </td>
          <td style="padding-bottom:14px;padding-left:12px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#1e293b;">Test &amp; afname</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Je ontvangt de test thuis. Met een eenvoudige vingerprik neem je zelf wat bloed af en stuurt dit terug naar Vita Health. Een gespecialiseerd laboratorium analyseert je monster.</p>
          </td>
        </tr>
        <tr>
          <td style="width:30px;vertical-align:top;">
            <div style="width:24px;height:24px;background:#1f1683;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#ffffff;">3</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#1e293b;">Resultaten bespreken</p>
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">Na ongeveer 2 tot 3 weken bespreken we jouw resultaten met je.</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Documenten -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:18px 22px;margin:0 0 20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0369a1;">📄 &nbsp;Lees voor aanvang</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding-bottom:8px;">
            <a href="${esc(deelnemersinfoUrl)}" style="display:inline-block;color:#1f1683;font-size:13px;font-weight:600;text-decoration:underline;">
              Deelnemersinformatie Vita Health Check →
            </a><br>
            <span style="font-size:12px;color:#64748b;">Wat houdt deelname in, hoe werkt de test en wat zijn uw rechten.</span>
          </td>
        </tr>
        <tr>
          <td>
            <a href="${esc(privacyverklaringUrl)}" style="display:inline-block;color:#1f1683;font-size:13px;font-weight:600;text-decoration:underline;">
              Privacyverklaring Vita Health →
            </a><br>
            <span style="font-size:12px;color:#64748b;">Hoe wij omgaan met uw persoonsgegevens en gezondheidsgegevens.</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Stappen -->
    <div style="background:#f8fafc;border-radius:10px;padding:20px 22px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1e293b;">Wat ga je invullen? (±10 minuten)</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:22px;vertical-align:top;padding-bottom:10px;">
            <div style="width:20px;height:20px;background:#eef4ff;border-radius:5px;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#1f1683;">1</div>
          </td>
          <td style="padding-bottom:10px;padding-left:10px;font-size:13px;color:#475569;">Persoons- en adresgegevens</td>
        </tr>
        <tr>
          <td style="width:22px;vertical-align:top;padding-bottom:10px;">
            <div style="width:20px;height:20px;background:#eef4ff;border-radius:5px;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#1f1683;">2</div>
          </td>
          <td style="padding-bottom:10px;padding-left:10px;font-size:13px;color:#475569;">Toestemmingsverklaringen</td>
        </tr>
        <tr>
          <td style="width:22px;vertical-align:top;">
            <div style="width:20px;height:20px;background:#eef4ff;border-radius:5px;text-align:center;line-height:20px;font-size:11px;font-weight:700;color:#1f1683;">3</div>
          </td>
          <td style="padding-left:10px;font-size:13px;color:#475569;">Gezondheids- en lifestyle-vragenlijst</td>
        </tr>
      </table>
    </div>

    ${btn(opts.intakeUrl, 'Intake starten')}
    ${p('Vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Uitnodiging: start jouw Vita Health intake',
    html: shell('Jouw intake uitnodiging', body),
  }
}

// ─── 2. Bevestiging na intake ─────────────────────────────────────────────────

export function bevestigingEmail(opts: {
  firstName: string
  statusUrl: string
  consents: readonly string[]
}): { subject: string; html: string } {
  const consentRows = opts.consents
    .map(c => `
      <tr>
        <td style="width:18px;vertical-align:top;padding-bottom:7px;color:#16a34a;font-size:13px;font-weight:700;">✓</td>
        <td style="padding-bottom:7px;padding-left:8px;font-size:12px;color:#475569;line-height:1.5;">${c}</td>
      </tr>`)
    .join('')

  const body = `
    ${greeting(opts.firstName)}
    ${p('Bedankt — jouw intake is volledig ontvangen! Hieronder vind je een bevestiging van wat je hebt ingevuld.')}

    <!-- Toestemmingen -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 22px;margin-bottom:16px;">
      <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#166534;">✓ &nbsp;Toestemmingen gegeven</p>
      <table style="width:100%;border-collapse:collapse;">${consentRows}</table>
    </div>

    <!-- Vragenlijst -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 22px;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0369a1;">✓ &nbsp;Gezondheidsvragenlijst ingevuld</p>
      <p style="margin:0;font-size:12px;color:#0369a1;line-height:1.5;">Je antwoorden zijn veilig opgeslagen en worden beoordeeld door een arts.</p>
    </div>

    ${p('Je ontvangt nader bericht zodra de intake is beoordeeld. Via onderstaande knop kun je de actuele status van jouw aanmelding altijd volgen.')}
    ${btn(opts.statusUrl, 'Mijn status bekijken')}
    ${p('Vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Bevestiging: jouw Vita Health intake is ontvangen',
    html: shell('Intake ontvangen!', body),
  }
}

// ─── 3. Intake goedgekeurd ────────────────────────────────────────────────────

export function intakeGoedgekeurdEmail(opts: {
  firstName: string
  statusUrl: string
}): { subject: string; html: string } {
  const body = `
    ${greeting(opts.firstName)}
    ${p('Goed nieuws! Een medisch deskundige heeft jouw intake beoordeeld en <strong style="color:#1e293b;">goedgekeurd</strong>. Jouw testkit wordt zo spoedig mogelijk naar jouw adres verstuurd.')}

    <!-- Goedkeuring -->
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 22px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#166534;">✓ &nbsp;Intake goedgekeurd</p>
      <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">De testkit wordt verstuurd. Je ontvangt bericht zodra de kit onderweg is.</p>
    </div>

    <!-- Voorbereiding -->
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:20px 22px;margin-bottom:20px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#0369a1;">Voorbereiding voor optimale resultaten</p>
      <p style="margin:0 0 10px;font-size:13px;color:#475569;line-height:1.6;">Houd rekening met het volgende in de <strong>3 uur vóór de bloedafname</strong>:</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:22px;vertical-align:top;padding-bottom:8px;color:#ef4444;font-size:14px;">✕</td>
          <td style="padding-bottom:8px;padding-left:8px;font-size:13px;color:#475569;line-height:1.5;">Niet eten</td>
        </tr>
        <tr>
          <td style="width:22px;vertical-align:top;color:#ef4444;font-size:14px;">✕</td>
          <td style="padding-left:8px;font-size:13px;color:#475569;line-height:1.5;">Geen cafeïnehoudende dranken (koffie, thee, energiedrank)</td>
        </tr>
      </table>
    </div>

    <!-- Video -->
    <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:10px;padding:20px 22px;margin-bottom:28px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#1e293b;">🎬 &nbsp;Zo werkt de bloedafname</p>
      <p style="margin:0 0 14px;font-size:13px;color:#475569;line-height:1.6;">Bekijk alvast het instructiefilmpje zodat je weet hoe de vingerprik werkt wanneer de kit arriveert.</p>
      <div style="text-align:center;">
        <a href="https://vimeo.com/1191821447?fl=pl&amp;fe=cm"
           style="display:inline-block;background:#1e293b;color:white;text-decoration:none;padding:10px 24px;border-radius:7px;font-size:13px;font-weight:600;">
          ▶ &nbsp;Instructiefilmpje bekijken
        </a>
      </div>
    </div>

    ${p('Wil je de huidige status van jouw aanmelding bekijken? Klik op de knop hieronder.')}
    ${btn(opts.statusUrl, 'Mijn status bekijken')}
    ${p('Vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Jouw intake is goedgekeurd — testkit wordt verstuurd',
    html: shell('Intake goedgekeurd!', body),
  }
}

// ─── 4. Intake hervatten (na on-hold → toch doorgaan) ────────────────────────

export function intakeHervattingEmail(opts: {
  firstName: string
  vragenlijstUrl: string
}): { subject: string; html: string } {
  const body = `
    ${greeting(opts.firstName)}
    ${p('Bedankt voor je geduld. Na ons contact is besloten dat je kunt doorgaan met de Vita Health Check. Klik op onderstaande knop om de gezondheidsvragenlijst in te vullen.')}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 22px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#166534;line-height:1.6;">
        ✓ &nbsp;Je intake is goedgekeurd. Vul de vragenlijst in om het aanmeldproces af te ronden.
      </p>
    </div>

    ${btn(opts.vragenlijstUrl, 'Vragenlijst invullen')}
    ${p('Vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Je kunt doorgaan met de Vita Health vragenlijst',
    html: shell('Ga verder met je aanmelding', body),
  }
}

// ─── 5. Medewerker uitnodiging ────────────────────────────────────────────────

export function medewerkerUitnodigingEmail(opts: {
  firstName: string
  role: string
  inviteUrl: string
}): { subject: string; html: string } {
  const ROLE_LABELS: Record<string, string> = {
    admin:         'Beheerder',
    arts:          'Arts',
    leefstijlarts: 'Leefstijlarts',
    medewerker:    'Medewerker',
  }
  const roleLabel = ROLE_LABELS[opts.role] ?? opts.role

  const body = `
    ${greeting(opts.firstName)}
    ${p(`Je bent uitgenodigd om te werken met het <strong>Vita Health Platform</strong> als <strong>${roleLabel}</strong>.`)}
    ${p('Klik op de knop hieronder om je account in te stellen. Je kiest zelf een wachtwoord en stelt een authenticator-app in voor extra beveiliging.')}

    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 22px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0369a1;">Wat je nodig hebt:</p>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:22px;vertical-align:top;padding-bottom:8px;color:#1f1683;font-size:14px;">1.</td>
          <td style="padding-bottom:8px;padding-left:6px;font-size:13px;color:#475569;line-height:1.5;">
            <strong>Wachtwoord instellen</strong> — minimaal 12 tekens, hoofdletter, cijfer en speciaal teken
          </td>
        </tr>
        <tr>
          <td style="width:22px;vertical-align:top;padding-bottom:8px;color:#1f1683;font-size:14px;">2.</td>
          <td style="padding-bottom:8px;padding-left:6px;font-size:13px;color:#475569;line-height:1.5;">
            <strong>Authenticator-app</strong> — installeer Google Authenticator of Microsoft Authenticator
          </td>
        </tr>
        <tr>
          <td style="width:22px;vertical-align:top;color:#1f1683;font-size:14px;">3.</td>
          <td style="padding-left:6px;font-size:13px;color:#475569;line-height:1.5;">
            <strong>QR-code scannen</strong> — je scant een QR-code om 2FA in te stellen
          </td>
        </tr>
      </table>
    </div>

    ${btn(opts.inviteUrl, 'Account instellen →')}
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin-top:8px;">
      Deze link is 24 uur geldig. Lukt het niet? Vraag de beheerder om een nieuwe uitnodiging.
    </p>
    ${p('Vragen? Neem contact op via <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk.vita-health.nl</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Uitnodiging Vita Health Platform',
    html: shell('Welkom bij Vita Health', body),
  }
}

// ─── 6. Reminder ──────────────────────────────────────────────────────────────

export function reminderEmail(opts: {
  firstName: string
  intakeUrl: string
  stoppedAfter: 'adresgegevens' | 'toestemmingen'
}): { subject: string; html: string } {
  const description = opts.stoppedAfter === 'toestemmingen'
    ? 'Je hebt je gegevens en toestemmingen al ingevuld — alleen de <strong style="color:#1e293b;">gezondheidsvragenlijst</strong> ontbreekt nog.'
    : 'Je hebt je aangemeld, maar de <strong style="color:#1e293b;">toestemmingen en vragenlijst</strong> zijn nog niet ingevuld.'

  const body = `
    ${greeting(opts.firstName)}
    ${p(`Je aanmelding voor de Vita Health Check is <strong style="color:#1e293b;">nog niet volledig</strong>. ${description}`)}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 22px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        <strong>Let op:</strong> je aanmelding is pas volledig als alle stappen zijn doorlopen. Je kunt verdergaan waar je gebleven was — eerder ingevulde gegevens worden herkend.
      </p>
    </div>

    ${btn(opts.intakeUrl, 'Intake hervatten')}
    ${p('Heb je de intake bewust niet afgerond of heb je vragen? Bezoek onze <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Herinnering: jouw Vita Health intake is nog niet afgerond',
    html: shell('Nog even afmaken', body),
  }
}
