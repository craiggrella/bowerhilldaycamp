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
    body: html,
  });

  const res = await postJSON(EMAIL_API_URL, { "X-Auth-APIKey": apiKey }, payload);
  if (res.status !== 200) {
    console.error("Email API error:", res.status, res.body);
    return false;
  }
  console.log(`Email sent to ${to}: "${subject}"`);
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

function priceForGrade(grade: string): number {
  const jrGrades = new Set(["Preschool", "K", "1st", "2nd"]);
  if (!grade) return 0;
  if (jrGrades.has(grade)) return 2500;
  if (grade === "6th and up") return 2500;
  return 7500;
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
  return `<span style="border:1px solid #1d4ed8;color:#1d4ed8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;padding:2px 6px;border-radius:3px;margin-left:4px">Helper</span>`;
}

// ─── Admin alert ─────────────────────────────────────────

// Sends a plain-text-ish HTML alert to the site admin. Fire-and-await at the
// error site; own try/catch so a failing alert never cascades.
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

// ─── Receipt email ───────────────────────────────────────

export type ReceiptCamper = {
  firstName: string;
  lastName: string;
  grade: string;
  campName: string;
  afternoonOptOut: boolean;
};

export type ReceiptData = {
  to: string;
  totalCents: number;
  stripePaymentId: string;
  campers: ReceiptCamper[];
};

export async function sendReceiptEmail(data: ReceiptData): Promise<boolean> {
  const ref = data.stripePaymentId.slice(-12);

  const camperRows = data.campers
    .map((c) => {
      const isHelper = c.grade === "6th and up";
      const schedule = scheduleFor(c.campName, c.afternoonOptOut);
      const price = priceForGrade(c.grade);
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #ddd;vertical-align:top">
            <div style="font-weight:700;font-size:15px;color:#000">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</div>
            <div style="margin-top:4px">${campBadge(c.campName)}${isHelper ? helperBadge() : ""}</div>
            <div style="font-size:13px;color:#000;margin-top:4px">Grade: ${escapeHtml(c.grade)} &bull; ${escapeHtml(schedule)}</div>
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #ddd;vertical-align:top;text-align:right;font-weight:700;font-size:15px;color:#000;white-space:nowrap">
            ${formatMoney(price)}
          </td>
        </tr>
      `;
    })
    .join("");

  const inner = `
    <h1 style="font-size:24px;font-weight:800;margin:16px 0 8px;color:#000">Payment received — thank you!</h1>
    <p style="font-size:14px;color:#000;margin:0 0 24px">Your registration for Bower Hill Day Camp is confirmed. Details below.</p>

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

    <h2 style="font-size:16px;font-weight:700;margin:0 0 8px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Campers</h2>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #ddd">
      ${camperRows}
    </table>

    <p style="font-size:13px;color:#000;margin:24px 0 0;line-height:1.5">
      If you haven't already, please complete the emergency contact and medical info step — you'll receive a second email confirming those details once they're on file.
    </p>
  `;

  return sendTransactional({
    to: data.to,
    subject: `Payment receipt — Bower Hill Day Camp`,
    html: shell(inner),
  });
}

// ─── Detailed confirmation email ─────────────────────────

export type DetailedCamper = {
  firstName: string;
  lastName: string;
  grade: string;
  campName: string;
  afternoonOptOut: boolean;
  allergies: string | null;
  medicalNotes: string | null;
};

export type DetailedEmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

export type DetailedGuardian = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

export type DetailedData = {
  to: string;
  guardian: DetailedGuardian;
  campers: DetailedCamper[];
  emergencyContacts: DetailedEmergencyContact[];
};

export async function sendDetailedConfirmationEmail(data: DetailedData): Promise<boolean> {
  const g = data.guardian;

  const camperSections = data.campers
    .map((c) => {
      const isHelper = c.grade === "6th and up";
      const schedule = scheduleFor(c.campName, c.afternoonOptOut);
      const price = priceForGrade(c.grade);
      return `
        <div style="border-bottom:1px solid #ddd;padding:14px 0">
          <div style="font-weight:700;font-size:16px;color:#000">${escapeHtml(c.firstName)} ${escapeHtml(c.lastName)}</div>
          <div style="margin-top:4px">${campBadge(c.campName)}${isHelper ? helperBadge() : ""}</div>
          <table style="width:100%;margin-top:8px;font-size:13px;color:#000;border-collapse:collapse">
            <tr><td style="padding:2px 0;width:110px"><strong>Grade</strong></td><td style="padding:2px 0">${escapeHtml(c.grade)}</td></tr>
            <tr><td style="padding:2px 0"><strong>Schedule</strong></td><td style="padding:2px 0">${escapeHtml(schedule)}</td></tr>
            <tr><td style="padding:2px 0"><strong>Price</strong></td><td style="padding:2px 0">${formatMoney(price)}</td></tr>
            <tr><td style="padding:2px 0;vertical-align:top"><strong>Allergies</strong></td><td style="padding:2px 0">${escapeHtml(c.allergies) || "None"}</td></tr>
            <tr><td style="padding:2px 0;vertical-align:top"><strong>Medical</strong></td><td style="padding:2px 0">${escapeHtml(c.medicalNotes) || "None"}</td></tr>
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
    <h1 style="font-size:24px;font-weight:800;margin:16px 0 8px;color:#000">You're all set!</h1>
    <p style="font-size:14px;color:#000;margin:0 0 24px">Here's the full record of your camp registration.</p>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">When &amp; where</h2>
    <div style="font-size:14px;color:#000;line-height:1.5;margin-bottom:24px">
      Bower Hill Community Church<br>
      70 Moffett St, Pittsburgh, PA 15243<br>
      <em>Camp dates to be announced — drop-off from 9:15 AM.</em>
    </div>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Parent / Guardian</h2>
    <table style="width:100%;font-size:14px;color:#000;border-collapse:collapse;margin-bottom:24px">
      <tr><td style="padding:2px 0;width:90px"><strong>Name</strong></td><td style="padding:2px 0">${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}</td></tr>
      <tr><td style="padding:2px 0"><strong>Email</strong></td><td style="padding:2px 0">${escapeHtml(g.email)}</td></tr>
      <tr><td style="padding:2px 0"><strong>Phone</strong></td><td style="padding:2px 0">${escapeHtml(g.phone)}</td></tr>
      <tr><td style="padding:2px 0;vertical-align:top"><strong>Address</strong></td><td style="padding:2px 0">${escapeHtml(g.address)}</td></tr>
    </table>

    <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Campers</h2>
    <div style="border-top:1px solid #ddd">
      ${camperSections}
    </div>

    <h2 style="font-size:13px;font-weight:700;margin:24px 0 6px;color:#000;text-transform:uppercase;letter-spacing:0.04em">Emergency contacts</h2>
    <ul style="font-size:14px;color:#000;line-height:1.5;margin:0;padding-left:20px">
      ${ecRows}
    </ul>
  `;

  return sendTransactional({
    to: data.to,
    subject: `Camp registration details — Bower Hill Day Camp`,
    html: shell(inner),
  });
}
