/**
 * Email helper for transactional emails.
 *
 * Configuration (all optional — falls back to console logging in dev):
 *   SMTP_HOST      e.g. smtp.gmail.com
 *   SMTP_PORT      e.g. 587
 *   SMTP_SECURE    "true" for port 465, omit/false for STARTTLS
 *   SMTP_USER      SMTP username / email address
 *   SMTP_PASS      SMTP password / app password
 *   EMAIL_FROM     Sender address, e.g. "GitVerse <no-reply@gitverse.dev>"
 *
 * When SMTP_HOST is not set the email body is printed to stdout so the reset
 * link is still accessible during local development without any mail server.
 */

import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) {
    // Dev fallback: ethereal / console transport
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(options: SendMailOptions): Promise<void> {
  const from =
    process.env.EMAIL_FROM ?? "GitVerse <no-reply@gitverse.dev>";

  const transport = createTransport();

  if (!transport) {
    // No SMTP configured — log to console so the link is accessible in dev.
    console.log(
      "\n========== [DEV EMAIL] ==========\n" +
        `To:      ${options.to}\n` +
        `Subject: ${options.subject}\n` +
        `\n${options.text}\n` +
        "=================================\n"
    );
    return;
  }

  await transport.sendMail({ from, ...options });
}

export function buildPasswordResetEmail(
  resetUrl: string,
  expiryMinutes = 60
): { html: string; text: string } {
  const text =
    `You requested a password reset for your GitVerse account.\n\n` +
    `Click the link below to set a new password. The link expires in ${expiryMinutes} minutes.\n\n` +
    `${resetUrl}\n\n` +
    `If you did not request this, you can safely ignore this email — your password will not change.\n`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="font-family:sans-serif;background:#0f1117;color:#e2e8f0;margin:0;padding:32px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#1a1d27;border-radius:12px;padding:40px;border:1px solid #2d3148;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:24px;font-weight:700;color:#7c6af7;">GitVerse</span>
            </td>
          </tr>
          <tr>
            <td>
              <h2 style="margin:0 0 16px;font-size:20px;color:#f1f5f9;">Reset your password</h2>
              <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6;">
                You requested a password reset. Click the button below to set a new password.
                This link expires in <strong style="color:#e2e8f0;">${expiryMinutes} minutes</strong>.
              </p>
              <a href="${resetUrl}"
                 style="display:inline-block;background:linear-gradient(135deg,#7c6af7,#5b8af7);
                        color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;
                        font-weight:600;font-size:15px;">
                Reset Password
              </a>
              <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
                If you did not request this, you can safely ignore this email.
                Your password will not change.
              </p>
              <hr style="border:none;border-top:1px solid #2d3148;margin:24px 0;" />
              <p style="margin:0;color:#475569;font-size:12px;">
                Or copy this link into your browser:<br />
                <span style="color:#7c6af7;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, text };
}
