import "server-only";
import nodemailer from "nodemailer";

// Server-only SMTP transport (nodemailer) — used instead of Supabase's
// built-in Auth email so invite/account emails go out even without SMTP
// configured in the Supabase dashboard. Auth links are minted via
// supabase.auth.admin.generateLink() (no email sent by Supabase) and
// delivered through this transport instead.
function getTransport() {
  return nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT ?? 587),
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const transport = getTransport();
    await transport.sendMail({
      from: process.env.MAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send email.",
    };
  }
}

export async function sendInviteEmail(
  to: string,
  inviteLink: string,
  companyName: string,
): Promise<{ ok: boolean; error?: string }> {
  return sendMail({
    to,
    subject: `You've been invited to join ${companyName} on Roster`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="margin-bottom: 8px;">You're invited to ${companyName}</h2>
        <p style="color: #555;">Click below to accept your invite and set a password.</p>
        <p>
          <a href="${inviteLink}"
             style="display: inline-block; margin-top: 12px; padding: 10px 20px; background: #5e6ad2; color: #fff; text-decoration: none; border-radius: 6px;">
            Accept invite
          </a>
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          If the button doesn't work, copy and paste this link into your browser:<br />
          <a href="${inviteLink}">${inviteLink}</a>
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
): Promise<{ ok: boolean; error?: string }> {
  return sendMail({
    to,
    subject: "Reset your Roster password",
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: #5e6ad2; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">Roster</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Reset your password
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Click below to confirm it's you and choose a new password.
                  </p>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="border-radius: 6px; background-color: #5e6ad2;">
                        <a href="${resetLink}"
                           style="display: inline-block; padding: 10px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">
                          Reset password
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 24px 0 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
                    If the button doesn't work, copy and paste this link into your browser:<br />
                    <a href="${resetLink}" style="color: #5e6ad2;">${resetLink}</a>
                  </p>
                  <p style="margin: 16px 0 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  });
}

function formatShiftTime(date: string, time: string): string {
  const d = new Date(`${date}T${time}`);
  if (Number.isNaN(d.getTime())) return time;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatShiftDate(date: string): string {
  const d = new Date(`${date}T00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const EMAIL_FONT =
  "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

function detailRow(
  label: string,
  value: string,
  opts: { muted?: boolean } = {},
): string {
  const valueStyle = opts.muted
    ? "font-size: 14px; line-height: 22px; color: #4b5563; text-align: right;"
    : "font-size: 14px; font-weight: 600; color: #111827; text-align: right;";
  return `
    <tr>
      <td colspan="2" style="padding: 0 20px;"><div style="border-top: 1px solid #e5e7eb;"></div></td>
    </tr>
    <tr>
      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; vertical-align: top; white-space: nowrap;">${label}</td>
      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; ${valueStyle}">${value}</td>
    </tr>
  `;
}

export async function sendShiftReminderEmail(
  to: string,
  shift: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    companyName?: string | null;
    description?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = shift.companyName || "Roster";
  return sendMail({
    to,
    subject: `Reminder: ${shift.title} — ${formatShiftDate(shift.date)}, ${formatShiftTime(shift.date, shift.startTime)}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: #5e6ad2; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Shift reminder
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Hi, this is a friendly reminder about your upcoming shift at ${companyName}.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Date</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${formatShiftDate(shift.date)}</td>
                    </tr>
                    ${detailRow("Time", `${formatShiftTime(shift.date, shift.startTime)} – ${formatShiftTime(shift.date, shift.endTime)}`)}
                    ${detailRow("Shift", shift.title)}
                    ${shift.description ? detailRow("Notes", shift.description, { muted: true }) : ""}
                  </table>
                  <p style="margin: 24px 0 0; font-family: ${EMAIL_FONT}; font-size: 13px; line-height: 20px; color: #6b7280;">
                    If you can't make this shift, please contact your manager as soon as possible.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
                    Times are shown in your local timezone.<br />
                    Sent by ${companyName} via Roster.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  });
}
