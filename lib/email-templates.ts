export type EmailTemplateKey =
  | "shiftAssigned"
  | "leaveReviewed"
  | "swapProposed"
  | "swapResponded"
  | "swapReviewed"
  | "shiftAdjustmentReviewed"
  | "shiftReminder"
  | "forgotClockOut";

export interface EmailTemplateOverride {
  subject: string;
  html: string;
}

export type EmailTemplates = Partial<Record<EmailTemplateKey, EmailTemplateOverride>>;

export const EMAIL_TEMPLATE_META: Record<EmailTemplateKey, { title: string; variables: string[] }> = {
  shiftAssigned: {
    title: "Shift assigned",
    variables: ["companyName", "shiftTitle", "date", "time", "description"],
  },
  shiftReminder: {
    title: "Shift reminder",
    variables: ["companyName", "shiftTitle", "date", "time", "description"],
  },
  leaveReviewed: {
    title: "Leave reviewed",
    variables: ["companyName", "type", "dateRange", "status", "comment"],
  },
  shiftAdjustmentReviewed: {
    title: "Adjustment reviewed",
    variables: ["companyName", "type", "date", "requestedTime", "status", "comment"],
  },
  swapProposed: {
    title: "Swap proposed",
    variables: [
      "companyName",
      "initiatorName",
      "swapType",
      "offeredShiftTitle",
      "offeredDate",
      "offeredTime",
      "requestedShiftTitle",
      "requestedDate",
      "requestedTime",
    ],
  },
  swapResponded: {
    title: "Swap responded",
    variables: [
      "companyName",
      "responderName",
      "response",
      "swapType",
      "offeredShiftTitle",
      "offeredDate",
      "offeredTime",
    ],
  },
  swapReviewed: {
    title: "Swap reviewed",
    variables: [
      "companyName",
      "status",
      "swapType",
      "offeredShiftTitle",
      "offeredDate",
      "offeredTime",
      "comment",
    ],
  },
  forgotClockOut: {
    title: "Forgot to clock out",
    variables: ["companyName", "clockInAt", "shiftTitle", "shiftEndAt", "clockLink"],
  },
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}
