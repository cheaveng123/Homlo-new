/**
 * Branded HTML version of an outbox email. The outbox stores plain text; this
 * turns it into the HireNow layout at send time:
 *
 * - each blank-line-separated block becomes a paragraph,
 * - a block that is only a link becomes a big button (label by template), and
 *   the raw link is repeated small at the bottom for mail apps that block buttons.
 *
 * Mail clients ignore <style> and web fonts unevenly, so everything is inline
 * and table-based, and the logo is a PNG (Gmail does not show SVG).
 */

const BUTTON_LABELS: Record<string, string> = {
  verify_email: "Confirm my email",
};

const COLORS = {
  primary: "#0891B2",
  bg: "#F3F6F5",
  card: "#FFFFFF",
  border: "#E6EDEF",
  text: "#12303C",
  muted: "#6A7C84",
};

const FONT = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const HEADING_FONT = "'Plus Jakarta Sans', Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function logoUrl() {
  return (process.env.HOMLO_EMAIL_LOGO_URL || "https://hirenowjobs.com/logo.png").trim();
}

function button(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px">
  <tr><td align="center" bgcolor="${COLORS.primary}" style="border-radius:999px">
    <a href="${esc(href)}" target="_blank" style="display:block;padding:15px 24px;font:600 16px/20px ${FONT};color:#FFFFFF;text-decoration:none;border-radius:999px">${esc(label)}</a>
  </td></tr>
</table>`;
}

function fallbackLinks(links: string[]) {
  if (!links.length) return "";
  const items = links
    .map((l) => `<a href="${esc(l)}" target="_blank" style="color:${COLORS.primary};word-break:break-all">${esc(l)}</a>`)
    .join("<br>");
  return `<p style="margin:8px 0 0;padding-top:16px;border-top:1px solid ${COLORS.border};font:400 12px/18px ${FONT};color:${COLORS.muted}">Button not working? Copy this link into your browser:<br>${items}</p>`;
}

export function renderEmailHtml(input: { subject: string; body: string; template?: string | null }): string {
  const label = (input.template && BUTTON_LABELS[input.template]) || "Open link";
  const links: string[] = [];
  const blocks = input.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      if (/^https?:\/\/\S+$/.test(block)) {
        links.push(block);
        return button(block, label);
      }
      return `<p style="margin:0 0 16px;font:400 15px/23px ${FONT};color:${COLORS.text}">${esc(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${COLORS.bg}" style="background:${COLORS.bg}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:10px"><img src="${esc(logoUrl())}" width="36" height="36" alt="" style="display:block;border:0;border-radius:10px"></td>
          <td style="font:800 19px/1 ${HEADING_FONT};color:${COLORS.text}">HireNow</td>
        </tr></table>
      </td></tr>
      <tr><td bgcolor="${COLORS.card}" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:22px;padding:32px 28px">
        <h1 style="margin:0 0 14px;font:800 22px/30px ${HEADING_FONT};color:${COLORS.text}">${esc(input.subject)}</h1>
        ${blocks}
        ${fallbackLinks(links)}
      </td></tr>
      <tr><td align="center" style="padding:20px 16px 0;font:400 12px/18px ${FONT};color:${COLORS.muted}">
        HireNow · <a href="https://hirenowjobs.com" style="color:${COLORS.muted}">hirenowjobs.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
