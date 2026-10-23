import "server-only";
import https from "https";

const EMAIL_API_URL = "https://mail.campaignplanner.org/api/transactional/send";

// ─── HTTP helper ─────────────────────────────────────────

// Node https module first (supports rejectUnauthorized for self-signed ESP cert), fetch fallback.
async function postJSON(
  url: string,
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; body: string }> {
  try {
    const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const parsed = new URL(url);
      const req = https.request(
        {
          hostname: parsed.hostname,
          path: parsed.pathname,
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          rejectUnauthorized: false,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve({ status: res.statusCode || 0, body: data }));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
    return result;
  } catch (err) {
    console.error("https module failed, trying fetch:", err);
  }

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body,
    });
    const text = await res.text();
    return { status: res.status, body: text };
  } catch (err) {
    console.error("fetch also failed:", err);
    return { status: 0, body: String(err) };
  }
}

// ─── Transport ───────────────────────────────────────────

// The mail server rewrites every double-quoted <a href="..."> into a
// links.campaignplanner.org tracking redirect (single-quoted hrefs pass
// through), and wraps the message in a second <html><body> unless the <body>
// tag is bare. So: move <body> attributes onto an inner div, and single-quote
// hrefs (a ' inside the URL becomes %27).
function prepareForEsp(html: string): string {
  return html
    .replace(/<body\b([^>]*)>([\s\S]*?)<\/body>/i, (match, attrs: string, inner: string) =>
      attrs.trim() ? `<body>\n<div${attrs}>${inner}</div>\n</body>` : match
    )
    .replace(/(<a\s[^>]*?\bhref\s*=\s*)"([^"]*)"/gi, (_m, pre: string, url: string) =>
      `${pre}'${url.replace(/'/g, "%27")}'`
    );
}

async function sendTransactional({ to, subject, html }: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.warn("EMAIL_API_KEY not configured — skipping send to", to);
    return false;
  }
  const fromName = process.env.EMAIL_FROM_NAME || "Bower Hill Day Camp";
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "admin@bowerhilldaycamp.com";

  const payload = JSON.stringify({
    fromname: fromName,
    fromemail: fromEmail,
    to,
    subject,
    body: prepareForEsp(html),
  });

  const res = await postJSON(EMAIL_API_URL, { "X-Auth-APIKey": apiKey }, payload);
  if (res.status !== 200) {
    console.error("Email API error:", res.status, res.body);
    return false;
  }
  return true;
}

// ─── Shared helpers ──────────────────────────────────────

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function scheduleFor(campName: string, optOut: boolean): string {
  if (campName === "Jr Day Camp") return "9:30 AM – 12:00 PM";
  if (optOut) return "9:30 AM – 12:00 PM (Morning only)";
  return "9:30 AM – 3:00 PM";
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function header(): string {
  return `
    <div style="border-top:4px solid #1e3a8a;padding:24px 0 16px">
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:22px;font-weight:800;color:#000;letter-spacing:-0.01em">
        Bower Hill Day Camp
      </div>
    </div>
  `;
}

function footer(): string {
  return `
    <div style="border-top:1px solid #000;margin-top:32px;padding-top:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#000;line-height:1.5">
      <div style="font-weight:600">Bower Hill Community Church</div>
      <div>70 Moffett St, Pittsburgh, PA 15243</div>
      <div style="margin-top:10px">Questions? Call 412-561-4114 or email office@bowerhillchurch.org</div>
    </div>
  `;
}

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    ${header()}
    ${inner}
    ${footer()}
  </div>
</body>
</html>`;
}

function campBadge(campName: string): string {
  const color = campName === "Day Camp" ? "#c2410c" : "#166534";
  return `<span style="border:1px solid ${color};color:${color};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 6px;border-radius:3px">${escapeHtml(campName)}</span>`;
}

function helperBadge(): string {
  return `<span style="border:1px solid #1d4ed8;color:#1d4ed8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 6px;border-radius:3px;margin-left:4px">Volunteer</span>`;
}

function firstYearBadge(): string {
  return `<span style="border:1px solid #166534;color:#166534;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 6px;border-radius:3px;margin-left:4px">1st Year — Free</span>`;
}

// ─── Admin alert ─────────────────────────────────────────

// Sends a plain-text-ish HTML alert to the site admin. Fire-and-await at the
// error site; own try/catch so a failing alert never cascades.
export async function sendAdminInvite(opts: {
  to: string;
  inviterEmail: string;
  actionLink: string;
}): Promise<boolean> {
  const subject = "You're invited to the Bower Hill Day Camp admin dashboard";
  const inner = `
    <p style="font-size:15px;margin:0 0 12px">Hi,</p>
    <p style="font-size:15px;line-height:1.55;margin:0 0 16px">
      <strong>${escapeHtml(opts.inviterEmail)}</strong> invited you to access the
      Bower Hill Day Camp admin dashboard.
    </p>
    <p style="font-size:15px;line-height:1.55;margin:0 0 20px">
      Click the button below to set your password and finish creating your account.
    </p>
    <p style="text-align:center;margin:0 0 24px">
      <a href="${opts.actionLink}"
         style="display:inline-block;background:#3b2562;color:#fff;font-weight:700;padding:12px 28px;border-radius:999px;text-decoration:none;font-size:15px">
        Set my password
      </a>
    </p>
    <p style="font-size:13px;color:#555;line-height:1.5;margin:0">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <span style="color:#1e3a8a;word-break:break-all">${escapeHtml(opts.actionLink)}</span>
    </p>
    <p style="font-size:13px;color:#888;line-height:1.5;margin:16px 0 0">
      Didn't expect this? You can ignore this email.
    </p>
  `;
  return sendTransactional({ to: opts.to, subject, html: shell(inner) });
}

export async function notifyAdmin(subject: string, details: Record<string, unknown>): Promise<void> {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "craig@craiggrella.com";
  const lines = Object.entries(details).map(([k, v]) => {
    const val = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    return `<div style="margin-bottom:10px"><strong>${escapeHtml(k)}</strong><br><pre style="margin:4px 0;padding:8px;background:#f5f5f5;border:1px solid #ddd;white-space:pre-wrap;word-break:break-all;font-size:12px">${escapeHtml(val)}</pre></div>`;
  }).join("");
  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000;background:#fff;padding:20px">
  <h1 style="font-size:18px;margin:0 0 8px">BHDC admin alert</h1>
  <p style="font-size:14px;margin:0 0 16px;color:#444">${escapeHtml(subject)}</p>
  ${lines}
  <p style="font-size:12px;color:#666;margin-top:20px">Time: ${new Date().toISOString()}</p>
</body></html>`;

  try {
    await sendTransactional({ to: adminEmail, subject: `[BHDC] ${subject}`, html });
  } catch (e) {
    console.error("Admin alert email failed:", e);
  }
}

// ─── Combined confirmation + receipt email ───────────────

export type ConfirmationCamper = {
  firstName: string;
  lastName: string;
  grade: string;
  age: string;
  campName: string;
  afternoonOptOut: boolean;
  allergies: string | null;
  firstYear: boolean;
  priceCents: number;
};

export type ConfirmationEmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type ConfirmationGuardian = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

export type ConfirmationData = {
  to: string;
  totalCents: number;
  stripePaymentId: string;
  guardian: ConfirmationGuardian;
  campers: ConfirmationCamper[];
  emergencyContacts: ConfirmationEmergencyContact[];
};

export async function sendConfirmationEmail(data: ConfirmationData): Promise<boolean> {
  const g = data.guardian;
  const ref = data.stripePaymentId.slice(-12);

  const camperSections = data.campers
    .map((c) => {
      const isHelper = c.grade === "6th and up";
      const schedule = scheduleFor(c.campName, c.afternoonOptOut);
      const priceLabel = c.firstYear
        ? `${formatMoney(c.priceCents)} <span style="color:#166534;font-weight:700">(1st year — free)</span>`
        : formatMoney(c.priceCents);
      return `
        <div style="border-bottom:1px solid #ddd;padding:14px 0">
          <div style="font-weight:700;font-size:16px;color:#000">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</div>
          <div style="margin-top:4px">${campBadge(c.campName)}${isHelper ? helperBadge() : ""}${c.firstYear ? firstYearBadge() : ""}</div>
          <table style="width:100%;margin-top:8px;font-size:13px;color:#000;border-collapse:collapse">
            <tr><td style="padding:2px 0;width:110px"><strong>Grade</strong></td><td style="padding:2px 0">${escapeHtml(c.grade)}</td></tr>
            <tr><td style="padding:2px 0"><strong>Age</strong></td><td style="padding:2px 0">${escapeHtml(c.age)}</td></tr>
            <tr><td style="padding:2px 0"><strong>Schedule</strong></td><td style="padding:2px 0">${escapeHtml(schedule)}</td></tr>
            <tr><td style="padding:2px 0"><strong>Price</strong></td><td style="padding:2px 0">${priceLabel}</td></tr>
            <tr><td style="padding:2px 0;vertical-align:top"><strong>Allergies / Medical</strong></td><td style="padding:2px 0">${escapeHtml(c.allergies) || "None"}</td></tr>
          </table>
        </div>
      `;
    })
    .join("");

  const ecRows = data.emergencyContacts.length
    ? data.emergencyContacts
        .map((ec) => `<li style="margin-bottom:4px">${escapeHtml(ec.name)} — ${escapeHtml(ec.relationship)} — ${escapeHtml(ec.phone)}</li>`)
        .join("")
    : `<li style="color:#666">None on file</li>`;

  const inner = `
    <h1 style="font-size:24px;font-weight:800;margin:16px 0 8px;color:#000">You're registered — thank you!</h1>
    <p style="font-size:14px;color:#000;margin:0 0 24px">This email is your receipt and a full record of your camp registration. Keep it handy — and feel free to print.</p>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Payment</h2>
    <div style="border:1px solid #000;padding:14px 16px;margin-bottom:24px">
      <table style="width:100%;font-size:14px;color:#000;border-collapse:collapse">
        <tr>
          <td style="padding:3px 0"><strong>Total paid</strong></td>
          <td style="padding:3px 0;text-align:right">${formatMoney(data.totalCents)}</td>
        </tr>
        <tr>
          <td style="padding:3px 0"><strong>Reference</strong></td>
          <td style="padding:3px 0;text-align:right;font-family:monospace;font-size:12px">${escapeHtml(ref)}</td>
        </tr>
      </table>
    </div>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">When &amp; where</h2>
    <div style="font-size:14px;color:#000;line-height:1.5;margin-bottom:24px">
      Bower Hill Community Church<br>
      70 Moffett St, Pittsburgh, PA 15243<br>
      <em>Monday July 27th to Friday July 31, 2026 — drop-off at 9:30 AM.</em>
    </div>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Parent / Guardian</h2>
    <table style="width:100%;font-size:14px;color:#000;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:2px 0;width:90px"><strong>Name</strong></td><td style="padding:2px 0">${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</td></tr>
      <tr><td style="padding:2px 0"><strong>Email</strong></td><td style="padding:2px 0">${escapeHtml(g.email)}</td></tr>
      <tr><td style="padding:2px 0"><strong>Phone</strong></td><td style="padding:2px 0">${escapeHtml(g.phone)}</td></tr>
      ${g.address ? `<tr><td style="padding:2px 0;vertical-align:top"><strong>Address</strong></td><td style="padding:2px 0">${escapeHtml(g.address)}</td></tr>` : ""}
    </table>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Campers</h2>
    <div style="border-top:1px solid #ddd;margin-bottom:24px">
      ${camperSections}
    </div>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Emergency contacts</h2>
    <ul style="font-size:14px;color:#000;line-height:1.5;margin:0;padding-left:20px">
      ${ecRows}
    </ul>
  `;

  return sendTransactional({
    to: data.to,
    subject: `Bower Hill Day Camp — Registration receipt & details`,
    html: shell(inner),
  });
}
