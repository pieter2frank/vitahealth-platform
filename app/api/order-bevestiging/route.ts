import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  const { email, first_name, last_name } = await req.json()

  if (!email || !first_name) {
    return NextResponse.json({ error: 'Ongeldige invoer' }, { status: 400 })
  }

  const { error } = await resend.emails.send({
    from: `Vita Health <${process.env.FROM_EMAIL ?? 'noreply@vita-health.nl'}>`,
    to: email,
    subject: 'Bevestiging: jouw Vita Health Check aanvraag',
    html: generateEmailHtml(first_name, last_name),
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: 'E-mail kon niet worden verzonden.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

function generateEmailHtml(first_name: string, last_name: string) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1f1683,#538bdd);padding:32px 32px 24px;">
      <div style="color:white;">
        <p style="margin:0 0 4px;font-size:13px;opacity:0.8;letter-spacing:1px;text-transform:uppercase;">Vita Health</p>
        <h1 style="margin:0;font-size:22px;font-weight:700;">Aanvraag ontvangen!</h1>
      </div>
    </div>

    <!-- Accent bar -->
    <div style="height:4px;background:linear-gradient(90deg,#17e4a1,#04b788);"></div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 16px;color:#1e293b;font-size:15px;">
        Beste ${first_name} ${last_name},
      </p>
      <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">
        We hebben jouw aanvraag voor een biomarker bloedtest goed ontvangen.
        Bedankt voor je interesse in Vita Health!
      </p>

      <!-- Wat nu? -->
      <div style="background:#f8fafc;border-radius:8px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 12px;font-weight:600;color:#1e293b;font-size:14px;">Wat gebeurt er nu?</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:32px;vertical-align:top;padding-bottom:12px;">
              <div style="width:24px;height:24px;background:#eef4ff;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#1f1683;">1</div>
            </td>
            <td style="padding-bottom:12px;padding-left:10px;color:#475569;font-size:13px;line-height:1.5;">
              <strong style="color:#1e293b;">Testkit verzonden</strong><br>
              Wij sturen je binnen 2-3 werkdagen een testkit op naar jouw adres.
            </td>
          </tr>
          <tr>
            <td style="width:32px;vertical-align:top;padding-bottom:12px;">
              <div style="width:24px;height:24px;background:#f0fdf9;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#04b788;">2</div>
            </td>
            <td style="padding-bottom:12px;padding-left:10px;color:#475569;font-size:13px;line-height:1.5;">
              <strong style="color:#1e293b;">Vingerprik thuis</strong><br>
              Met een kleine vingerprik neem je zelf een bloedmonster af.
            </td>
          </tr>
          <tr>
            <td style="width:32px;vertical-align:top;">
              <div style="width:24px;height:24px;background:#fefce8;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#d97706;">3</div>
            </td>
            <td style="padding-left:10px;color:#475569;font-size:13px;line-height:1.5;">
              <strong style="color:#1e293b;">Resultaten binnen 2 weken</strong><br>
              Na ontvangst analyseren we je bloed en ontvang je jouw resultaten.
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0 0 24px;color:#64748b;font-size:13px;">
        Heb je vragen? Bezoek onze
        <a href="https://helpdesk.vita-health.nl" style="color:#1f1683;">helpdesk</a>.
      </p>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        © ${new Date().getFullYear()} Vita Health ·
        <a href="https://ikwilgraageentest.vita-health.nl" style="color:#94a3b8;">ikwilgraageentest.vita-health.nl</a>
      </p>
    </div>
  </div>
</body>
</html>`
}
