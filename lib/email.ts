import nodemailer from "nodemailer";

const PLATFORM = "ThryveUp";

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");

  if (!user || !pass) {
    throw new Error("SMTP credentials are not configured");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendOtpEmail({
  to,
  code,
  verifyUrl,
  purposeLabel,
}: {
  to: string;
  code: string;
  verifyUrl: string;
  purposeLabel: string;
}) {
  const from = process.env.SMTP_FROM || `"${PLATFORM}" <${process.env.SMTP_USER}>`;
  const transporter = getTransporter();

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;background:#f8fafc;border-radius:16px;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;padding:10px 16px;border-radius:12px;letter-spacing:0.3px;">
          ${PLATFORM}
        </div>
      </div>
      <h1 style="font-size:22px;margin:0 0 8px;">Your verification code</h1>
      <p style="margin:0 0 20px;color:#475569;line-height:1.5;">
        Use this one-time code to ${purposeLabel}. It expires in 10 minutes.
      </p>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <div style="font-size:32px;letter-spacing:8px;font-weight:700;color:#1d4ed8;">${code}</div>
      </div>
      <p style="margin:0 0 12px;color:#475569;line-height:1.5;">
        Or verify instantly with this secure link:
      </p>
      <p style="margin:0 0 24px;">
        <a href="${verifyUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">
          Verify with link
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  `;

  const text = `${PLATFORM} verification code: ${code}

Use this code to ${purposeLabel}. It expires in 10 minutes.

Or open this link to verify:
${verifyUrl}

If you did not request this, ignore this email.`;

  await transporter.sendMail({
    from,
    to,
    subject: `${PLATFORM} verification code`,
    text,
    html,
  });
}
