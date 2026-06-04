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
        <a href="mailto:info@vita-health.nl" style="color:#94a3b8;text-decoration:none;">info@vita-health.nl</a>
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
}): { subject: string; html: string } {
  const body = `
    ${greeting(opts.firstName)}
    ${p('Je bent uitgenodigd om de intake te starten voor de <strong style="color:#1e293b;">Vita Health biomarkertest</strong>. Dit duurt ongeveer 10 minuten.')}

    <div style="background:#f8fafc;border-radius:10px;padding:20px 22px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1e293b;">Wat ga je invullen?</p>
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
    ${p('Vragen? Neem contact op via <a href="mailto:info@vita-health.nl" style="color:#1f1683;">info@vita-health.nl</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
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
    ${p('Vragen? Neem contact op via <a href="mailto:info@vita-health.nl" style="color:#1f1683;">info@vita-health.nl</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
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
    ${p('Vragen? Neem contact op via <a href="mailto:info@vita-health.nl" style="color:#1f1683;">info@vita-health.nl</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Jouw intake is goedgekeurd — testkit wordt verstuurd',
    html: shell('Intake goedgekeurd!', body),
  }
}

// ─── 4. Reminder ──────────────────────────────────────────────────────────────

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
    ${p(`Je aanmelding voor de Vita Health biomarkertest is <strong style="color:#1e293b;">nog niet volledig</strong>. ${description}`)}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 22px;margin-bottom:28px;">
      <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
        <strong>Let op:</strong> je aanmelding is pas volledig als alle stappen zijn doorlopen. Je kunt verdergaan waar je gebleven was — eerder ingevulde gegevens worden herkend.
      </p>
    </div>

    ${btn(opts.intakeUrl, 'Intake hervatten')}
    ${p('Heb je de intake bewust niet afgerond of heb je vragen? Stuur een e-mail naar <a href="mailto:info@vita-health.nl" style="color:#1f1683;">info@vita-health.nl</a>.', 'text-align:center;font-size:12px;color:#94a3b8;')}
  `
  return {
    subject: 'Herinnering: jouw Vita Health intake is nog niet afgerond',
    html: shell('Nog even afmaken', body),
  }
}
