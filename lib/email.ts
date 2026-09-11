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

export async function sendForgotClockOutEmail(
  to: string,
  info: {
    clockInAt: string; // ISO instant
    shiftTitle?: string | null;
    shiftEndAt?: string | null; // ISO instant, if matched to a shift
    companyName?: string | null;
    timezone: string;
    clockLink: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = info.companyName || "Roster";
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: info.timezone,
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  return sendMail({
    to,
    subject: "Did you forget to clock out?",
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: #dc2626; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Did you forget to clock out?
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    You're still clocked in at ${companyName}, past the end of your shift.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Clocked in</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${fmt(info.clockInAt)}</td>
                    </tr>
                    ${info.shiftTitle ? detailRow("Shift", info.shiftTitle) : ""}
                    ${info.shiftEndAt ? detailRow("Shift ended", fmt(info.shiftEndAt)) : ""}
                  </table>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px;">
                    <tr>
                      <td style="border-radius: 6px; background-color: #dc2626;">
                        <a href="${info.clockLink}"
                           style="display: inline-block; padding: 10px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none;">
                          Clock out now
                        </a>
                      </td>
                    </tr>
                  </table>
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

const LEAVE_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  bereavement: "Bereavement",
  other: "Other",
};

export async function sendLeaveReviewedEmail(
  to: string,
  request: {
    type: string;
    startDate: string;
    endDate: string;
    status: "approved" | "denied";
    reviewerComment?: string | null;
    companyName?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = request.companyName || "Roster";
  const typeLabel = LEAVE_TYPE_LABELS[request.type] ?? request.type;
  const dateRange =
    request.startDate === request.endDate
      ? formatShiftDate(request.startDate)
      : `${formatShiftDate(request.startDate)} – ${formatShiftDate(request.endDate)}`;
  const approved = request.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  return sendMail({
    to,
    subject: `Your ${typeLabel} leave request was ${request.status}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: ${accent}; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Leave request ${request.status}
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Your ${typeLabel.toLowerCase()} leave request has been ${request.status}.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Dates</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${dateRange}</td>
                    </tr>
                    ${detailRow("Type", typeLabel)}
                    ${request.reviewerComment ? detailRow("Comment", request.reviewerComment, { muted: true }) : ""}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
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

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  early_out: "early out",
  late_in: "late in",
};

export async function sendShiftAdjustmentReviewedEmail(
  to: string,
  request: {
    adjustmentType: string;
    date: string;
    requestedTime: string;
    status: "approved" | "denied";
    reviewerComment?: string | null;
    companyName?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = request.companyName || "Roster";
  const typeLabel = ADJUSTMENT_TYPE_LABELS[request.adjustmentType] ?? request.adjustmentType;
  const approved = request.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  return sendMail({
    to,
    subject: `Your ${typeLabel} request was ${request.status}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: ${accent}; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Shift adjustment ${request.status}
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Your ${typeLabel} request has been ${request.status}.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Date</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${formatShiftDate(request.date)}</td>
                    </tr>
                    ${detailRow("Requested time", request.requestedTime)}
                    ${request.reviewerComment ? detailRow("Comment", request.reviewerComment, { muted: true }) : ""}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
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

export async function sendShiftAssignedEmail(
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
    subject: `New shift assigned: ${shift.title} — ${formatShiftDate(shift.date)}`,
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
                    You've been assigned a shift
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    You've been added to the schedule at ${companyName}.
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

type SwapShiftInfo = { title: string; date: string; startTime: string; endTime: string };

export async function sendShiftSwapProposedEmail(
  to: string,
  input: {
    swapType: "giveaway" | "trade";
    initiatorName: string;
    companyName?: string | null;
    offeredShift: SwapShiftInfo;
    requestedShift?: SwapShiftInfo | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = input.companyName || "Roster";
  const kind = input.swapType === "trade" ? "trade" : "give-away";
  return sendMail({
    to,
    subject: `${input.initiatorName} proposed a shift ${kind}`,
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
                    New shift ${kind} request
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    ${input.initiatorName} would like to ${input.swapType === "trade" ? "trade shifts with you" : "give you one of their shifts"}.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Offered shift</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${input.offeredShift.title}</td>
                    </tr>
                    ${detailRow("Date", formatShiftDate(input.offeredShift.date))}
                    ${detailRow("Time", `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`)}
                    ${
                      input.requestedShift
                        ? `${detailRow("In exchange for", input.requestedShift.title)}${detailRow("Date", formatShiftDate(input.requestedShift.date))}${detailRow("Time", `${formatShiftTime(input.requestedShift.date, input.requestedShift.startTime)} – ${formatShiftTime(input.requestedShift.date, input.requestedShift.endTime)}`)}`
                        : ""
                    }
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
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

export async function sendShiftSwapRespondedEmail(
  to: string,
  input: {
    swapType: "giveaway" | "trade";
    response: "accepted" | "declined";
    responderName: string;
    companyName?: string | null;
    offeredShift: SwapShiftInfo;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = input.companyName || "Roster";
  const accepted = input.response === "accepted";
  const accent = accepted ? "#5e6ad2" : "#dc2626";
  return sendMail({
    to,
    subject: `Your swap request was ${input.response}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: ${accent}; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Swap request ${input.response}
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    ${input.responderName} has ${input.response} your shift ${input.swapType === "trade" ? "trade" : "give-away"} request${accepted ? ". It now needs manager approval." : "."}
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Shift</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${input.offeredShift.title}</td>
                    </tr>
                    ${detailRow("Date", formatShiftDate(input.offeredShift.date))}
                    ${detailRow("Time", `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`)}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
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

export async function sendShiftSwapReviewedEmail(
  to: string,
  input: {
    swapType: "giveaway" | "trade";
    status: "approved" | "denied";
    reviewerComment?: string | null;
    companyName?: string | null;
    offeredShift: SwapShiftInfo;
  },
): Promise<{ ok: boolean; error?: string }> {
  const companyName = input.companyName || "Roster";
  const approved = input.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  return sendMail({
    to,
    subject: `Your shift swap was ${input.status}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f5f7; padding: 32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; width: 100%;">
              <tr>
                <td style="background-color: ${accent}; padding: 20px 32px; border-radius: 8px 8px 0 0;">
                  <span style="font-family: ${EMAIL_FONT}; font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: 0.02em;">${companyName}</span>
                </td>
              </tr>
              <tr>
                <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h1 style="margin: 0 0 8px; font-family: ${EMAIL_FONT}; font-size: 20px; font-weight: 700; color: #111827;">
                    Shift swap ${input.status}
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Your shift ${input.swapType === "trade" ? "trade" : "give-away"} request has been ${input.status} by a manager.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Shift</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${input.offeredShift.title}</td>
                    </tr>
                    ${detailRow("Date", formatShiftDate(input.offeredShift.date))}
                    ${detailRow("Time", `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`)}
                    ${input.reviewerComment ? detailRow("Comment", input.reviewerComment, { muted: true }) : ""}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px 32px 0; text-align: center;">
                  <p style="margin: 0; font-family: ${EMAIL_FONT}; font-size: 12px; line-height: 18px; color: #9ca3af;">
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
