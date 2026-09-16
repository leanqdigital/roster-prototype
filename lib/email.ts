import "server-only";
import nodemailer from "nodemailer";
import { renderTemplate } from "./email-templates";
import type { EmailTemplateOverride } from "./email-templates";

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

type RenderedEmail = { subject: string; html: string };

// Wraps a custom (admin-edited) template's inner HTML in the same header
// bar / card / footer shell used by the default templates, so edited
// templates look consistent with the built-in ones instead of rendering
// as bare, unstyled HTML.
function wrapCustomEmailBody(
  companyName: string,
  accent: string,
  innerHtml: string,
): string {
  return `
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
              <td style="background-color: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                ${innerHtml}
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
  `;
}

// --- Shift reminder ---------------------------------------------------

export interface ShiftReminderInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  companyName?: string | null;
  description?: string | null;
}

export function renderShiftReminderEmail(
  shift: ShiftReminderInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = shift.companyName || "Roster";
  if (customTemplate) {
    const vars = {
      companyName,
      shiftTitle: shift.title,
      date: formatShiftDate(shift.date),
      time: `${formatShiftTime(shift.date, shift.startTime)} – ${formatShiftTime(shift.date, shift.endTime)}`,
      description: shift.description ?? "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, "#5e6ad2", renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftReminderEmail(
  to: string,
  shift: ShiftReminderInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftReminderEmail(shift, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Understaffed shift ------------------------------------------------

export interface UnderstaffedShiftInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  teamName?: string | null;
  staffedCount: number;
  requiredCount: number;
  companyName?: string | null;
}

export function renderUnderstaffedShiftEmail(
  shift: UnderstaffedShiftInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = shift.companyName || "Roster";
  const shortage = shift.requiredCount - shift.staffedCount;
  if (customTemplate) {
    const vars = {
      companyName,
      shiftTitle: shift.title,
      date: formatShiftDate(shift.date),
      time: `${formatShiftTime(shift.date, shift.startTime)} – ${formatShiftTime(shift.date, shift.endTime)}`,
      teamName: shift.teamName ?? "",
      staffedCount: String(shift.staffedCount),
      requiredCount: String(shift.requiredCount),
      shortage: String(shortage),
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, "#dc2626", renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
    subject: `Understaffed: ${shift.title} — ${formatShiftDate(shift.date)}`,
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
                    Shift is understaffed
                  </h1>
                  <p style="margin: 0 0 24px; font-family: ${EMAIL_FONT}; font-size: 14px; line-height: 22px; color: #4b5563;">
                    Tomorrow's shift still needs more staff. Only ${shift.staffedCount} of ${shift.requiredCount} people are assigned.
                  </p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;">
                    <tr>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 13px; color: #6b7280; white-space: nowrap;">Date</td>
                      <td style="padding: 16px 20px; font-family: ${EMAIL_FONT}; font-size: 14px; font-weight: 600; color: #111827; text-align: right;">${formatShiftDate(shift.date)}</td>
                    </tr>
                    ${detailRow("Time", `${formatShiftTime(shift.date, shift.startTime)} – ${formatShiftTime(shift.date, shift.endTime)}`)}
                    ${detailRow("Shift", shift.title)}
                    ${shift.teamName ? detailRow("Team", shift.teamName) : ""}
                    ${detailRow("Staffed", `${shift.staffedCount} of ${shift.requiredCount}`)}
                    ${shortage > 0 ? detailRow("Still needed", `${shortage} more`, { muted: true }) : ""}
                  </table>
                  <p style="margin: 24px 0 0; font-family: ${EMAIL_FONT}; font-size: 13px; line-height: 20px; color: #6b7280;">
                    Please review the schedule and fill this shift as soon as possible.
                  </p>
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
  };
}

export async function sendUnderstaffedShiftEmail(
  to: string,
  shift: UnderstaffedShiftInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderUnderstaffedShiftEmail(shift, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Forgot to clock out ------------------------------------------------

export interface ForgotClockOutInput {
  clockInAt: string; // ISO instant
  shiftTitle?: string | null;
  shiftEndAt?: string | null; // ISO instant, if matched to a shift
  companyName?: string | null;
  timezone: string;
  clockLink: string;
}

export function renderForgotClockOutEmail(
  info: ForgotClockOutInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
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
  if (customTemplate) {
    const vars = {
      companyName,
      clockInAt: fmt(info.clockInAt),
      shiftTitle: info.shiftTitle ?? "",
      shiftEndAt: info.shiftEndAt ? fmt(info.shiftEndAt) : "",
      clockLink: info.clockLink,
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, "#dc2626", renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendForgotClockOutEmail(
  to: string,
  info: ForgotClockOutInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderForgotClockOutEmail(info, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Leave reviewed -------------------------------------------------------

const LEAVE_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacation",
  sick: "Sick",
  personal: "Personal",
  bereavement: "Bereavement",
  other: "Other",
};

export interface LeaveReviewedInput {
  type: string;
  startDate: string;
  endDate: string;
  status: "approved" | "denied";
  reviewerComment?: string | null;
  companyName?: string | null;
}

export function renderLeaveReviewedEmail(
  request: LeaveReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = request.companyName || "Roster";
  const typeLabel = LEAVE_TYPE_LABELS[request.type] ?? request.type;
  const dateRange =
    request.startDate === request.endDate
      ? formatShiftDate(request.startDate)
      : `${formatShiftDate(request.startDate)} – ${formatShiftDate(request.endDate)}`;
  const approved = request.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  if (customTemplate) {
    const vars = {
      companyName,
      type: typeLabel,
      dateRange,
      status: request.status,
      comment: request.reviewerComment ?? "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, accent, renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendLeaveReviewedEmail(
  to: string,
  request: LeaveReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderLeaveReviewedEmail(request, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Shift adjustment reviewed --------------------------------------------

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  early_out: "early out",
  late_in: "late in",
};

export interface ShiftAdjustmentReviewedInput {
  adjustmentType: string;
  date: string;
  requestedTime: string;
  status: "approved" | "denied";
  reviewerComment?: string | null;
  companyName?: string | null;
}

export function renderShiftAdjustmentReviewedEmail(
  request: ShiftAdjustmentReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = request.companyName || "Roster";
  const typeLabel = ADJUSTMENT_TYPE_LABELS[request.adjustmentType] ?? request.adjustmentType;
  const approved = request.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  if (customTemplate) {
    const vars = {
      companyName,
      type: typeLabel,
      date: formatShiftDate(request.date),
      requestedTime: request.requestedTime,
      status: request.status,
      comment: request.reviewerComment ?? "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, accent, renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftAdjustmentReviewedEmail(
  to: string,
  request: ShiftAdjustmentReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftAdjustmentReviewedEmail(request, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Shift assigned ---------------------------------------------------

export interface ShiftAssignedInput {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  companyName?: string | null;
  description?: string | null;
}

export function renderShiftAssignedEmail(
  shift: ShiftAssignedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = shift.companyName || "Roster";
  if (customTemplate) {
    const vars = {
      companyName,
      shiftTitle: shift.title,
      date: formatShiftDate(shift.date),
      time: `${formatShiftTime(shift.date, shift.startTime)} – ${formatShiftTime(shift.date, shift.endTime)}`,
      description: shift.description ?? "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, "#5e6ad2", renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftAssignedEmail(
  to: string,
  shift: ShiftAssignedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftAssignedEmail(shift, customTemplate);
  return sendMail({ to, subject, html });
}

// --- Shift swap: proposed / responded / reviewed --------------------------

type SwapShiftInfo = { title: string; date: string; startTime: string; endTime: string };

export interface SwapProposedInput {
  swapType: "giveaway" | "trade";
  initiatorName: string;
  companyName?: string | null;
  offeredShift: SwapShiftInfo;
  requestedShift?: SwapShiftInfo | null;
}

export function renderShiftSwapProposedEmail(
  input: SwapProposedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = input.companyName || "Roster";
  const kind = input.swapType === "trade" ? "trade" : "give-away";
  if (customTemplate) {
    const vars = {
      companyName,
      initiatorName: input.initiatorName,
      swapType: input.swapType,
      offeredShiftTitle: input.offeredShift.title,
      offeredDate: formatShiftDate(input.offeredShift.date),
      offeredTime: `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`,
      requestedShiftTitle: input.requestedShift?.title ?? "",
      requestedDate: input.requestedShift ? formatShiftDate(input.requestedShift.date) : "",
      requestedTime: input.requestedShift
        ? `${formatShiftTime(input.requestedShift.date, input.requestedShift.startTime)} – ${formatShiftTime(input.requestedShift.date, input.requestedShift.endTime)}`
        : "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, "#5e6ad2", renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftSwapProposedEmail(
  to: string,
  input: SwapProposedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftSwapProposedEmail(input, customTemplate);
  return sendMail({ to, subject, html });
}

export interface SwapRespondedInput {
  swapType: "giveaway" | "trade";
  response: "accepted" | "declined";
  responderName: string;
  companyName?: string | null;
  offeredShift: SwapShiftInfo;
}

export function renderShiftSwapRespondedEmail(
  input: SwapRespondedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = input.companyName || "Roster";
  const accepted = input.response === "accepted";
  const accent = accepted ? "#5e6ad2" : "#dc2626";
  if (customTemplate) {
    const vars = {
      companyName,
      responderName: input.responderName,
      response: input.response,
      swapType: input.swapType,
      offeredShiftTitle: input.offeredShift.title,
      offeredDate: formatShiftDate(input.offeredShift.date),
      offeredTime: `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`,
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, accent, renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftSwapRespondedEmail(
  to: string,
  input: SwapRespondedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftSwapRespondedEmail(input, customTemplate);
  return sendMail({ to, subject, html });
}

export interface SwapReviewedInput {
  swapType: "giveaway" | "trade";
  status: "approved" | "denied";
  reviewerComment?: string | null;
  companyName?: string | null;
  offeredShift: SwapShiftInfo;
}

export function renderShiftSwapReviewedEmail(
  input: SwapReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): RenderedEmail {
  const companyName = input.companyName || "Roster";
  const approved = input.status === "approved";
  const accent = approved ? "#5e6ad2" : "#dc2626";
  if (customTemplate) {
    const vars = {
      companyName,
      status: input.status,
      swapType: input.swapType,
      offeredShiftTitle: input.offeredShift.title,
      offeredDate: formatShiftDate(input.offeredShift.date),
      offeredTime: `${formatShiftTime(input.offeredShift.date, input.offeredShift.startTime)} – ${formatShiftTime(input.offeredShift.date, input.offeredShift.endTime)}`,
      comment: input.reviewerComment ?? "",
    };
    return {
      subject: renderTemplate(customTemplate.subject, vars),
      html: wrapCustomEmailBody(companyName, accent, renderTemplate(customTemplate.html, vars)),
    };
  }
  return {
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
  };
}

export async function sendShiftSwapReviewedEmail(
  to: string,
  input: SwapReviewedInput,
  customTemplate?: EmailTemplateOverride | null,
): Promise<{ ok: boolean; error?: string }> {
  const { subject, html } = renderShiftSwapReviewedEmail(input, customTemplate);
  return sendMail({ to, subject, html });
}
