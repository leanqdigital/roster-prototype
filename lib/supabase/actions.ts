"use server";

import { requireRole } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActivityAction } from "@/lib/company-data";
import {
  sendInviteEmail,
  sendShiftAssignedEmail,
  sendLeaveReviewedEmail,
  sendShiftAdjustmentReviewedEmail,
  sendShiftSwapProposedEmail,
  sendShiftSwapRespondedEmail,
  sendShiftSwapReviewedEmail,
  renderShiftAssignedEmail,
  renderShiftReminderEmail,
  renderLeaveReviewedEmail,
  renderShiftAdjustmentReviewedEmail,
  renderShiftSwapProposedEmail,
  renderShiftSwapRespondedEmail,
  renderShiftSwapReviewedEmail,
  renderForgotClockOutEmail,
} from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-url";
import type { EmailSettings } from "@/lib/company";
import type { EmailTemplateKey, EmailTemplateOverride, EmailTemplates } from "@/lib/email-templates";

// email_settings may be missing/partial on older rows before the column
// backfilled or if a key was added later — default every key to enabled.
type BooleanEmailSettingKey = {
  [K in keyof EmailSettings]: EmailSettings[K] extends boolean ? K : never;
}[keyof EmailSettings];

function emailEnabled(
  settings: Partial<EmailSettings> | null | undefined,
  key: BooleanEmailSettingKey,
): boolean {
  return settings?.[key] ?? true;
}

export interface InviteEmployeeInput {
  email: string;
  personId: string | null;
  role: "employee" | "manager" | "hr";
}

// Real email invite. Verifies the caller's role/company via the regular
// (RLS-scoped) server client BEFORE touching the service-role admin client —
// guards against confused-deputy misuse of the admin API.
//
// Uses generateLink() (mints the invite link, sends no email) instead of
// inviteUserByEmail() (which requires SMTP configured in the Supabase
// dashboard) — delivery instead goes through our own nodemailer transport
// (lib/email.ts), so no Supabase-side SMTP setup is required.
export async function inviteEmployee(
  input: InviteEmployeeInput,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole(input.role === "hr" ? ["company_admin"] : ["manager", "company_admin"]);
  if (!profile.companyId) {
    return { ok: false, error: "No company context for this account." };
  }

  const origin = getSiteOrigin();

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.companyId)
    .single();

  const admin = createAdminClient();

  // HR invites have no people row, so the trigger can't email-match.
  // Mint a pending_invites row server-side — the trigger validates and
  // consumes it on auth.users INSERT.
  if (input.role === "hr") {
    const { error: inviteError } = await admin
      .from("pending_invites")
      .insert({
        company_id: profile.companyId,
        email: input.email,
        intended_role: "hr",
        created_by: profile.id,
      });
    if (inviteError) {
      return { ok: false, error: inviteError.message };
    }
  }

  const linkOptions = {
    redirectTo: `${origin}/auth/callback?next=/accept-invite`,
    data: {
      intended_role: input.role,
      company_id: profile.companyId,
      person_id: input.personId,
    },
  };
  let linkType: "invite" | "recovery" = "invite";
  let { data, error } = await admin.auth.admin.generateLink({
    type: linkType,
    email: input.email,
    options: linkOptions,
  });

  // A prior invite attempt may have already created (and partially
  // verified) the auth.users row for this email — generateLink({type:
  // "invite"}) rejects that with email_exists. Fall back to a recovery
  // link, which works for existing unconfirmed users and lands on the
  // same /accept-invite password-set flow.
  if (error?.code === "email_exists") {
    linkType = "recovery";
    ({ data, error } = await admin.auth.admin.generateLink({
      type: linkType,
      email: input.email,
      options: linkOptions,
    }));

    // handle_new_user() only fires on INSERT into auth.users. For an
    // existing user (this branch), that trigger never re-runs, so a
    // re-invite with a different role/company/person would otherwise
    // leave the stale profiles row in place. Sync it here explicitly.
    if (!error && data?.user) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({
          role: input.role,
          company_id: profile.companyId,
          person_id: input.personId,
        })
        .eq("id", data.user.id);
      if (profileError) {
        return { ok: false, error: profileError.message };
      }
      // Recovery path skips the trigger, so the pending_invites row minted
      // above is never consumed — clean it up.
      if (input.role === "hr") {
        await admin
          .from("pending_invites")
          .delete()
          .eq("email", input.email)
          .eq("company_id", profile.companyId);
      }
    }
  }

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to generate invite link." };
  }

  // Don't email Supabase's own action_link — visiting it (GET) verifies
  // and consumes the token immediately, so email security scanners that
  // prefetch links burn it before the invitee ever clicks. Instead, email
  // a link to our own confirm page, which only calls verifyOtp() on an
  // explicit user click (scanners follow GET redirects but don't submit
  // forms/click buttons), then forwards to /accept-invite.
  const confirmLink = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
    data.properties!.hashed_token,
  )}&type=${linkType}&next=${encodeURIComponent("/accept-invite")}`;

  const sent = await sendInviteEmail(input.email, confirmLink, company?.name ?? "Roster");
  if (!sent.ok) {
    return { ok: false, error: sent.error ?? "Failed to send invite email." };
  }
  return { ok: true };
}

// Same endTime calc as app/api/cron/shift-reminders/route.ts — not worth
// extracting a shared helper for two call sites.
function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return startTime;
  const total = (h * 60 + m + durationMinutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Best-effort notification after a manual assignPerson() call. Errors are
// swallowed as { ok: true } no-ops (missing/inactive person, missing shift)
// so a mutation that already succeeded in the DB is never blocked by email.
export async function notifyShiftAssigned(
  shiftId: string,
  personId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole(["manager", "company_admin"]);
  if (!profile.companyId) return { ok: false, error: "No company context." };

  const supabase = await createClient(); // RLS-scoped — cross-company id silently returns null, safe no-op

  const { data: person } = await supabase
    .from("people")
    .select("email, status")
    .eq("id", personId)
    .single();
  if (!person?.email || person.status !== "active") return { ok: true };

  const { data: shift } = await supabase
    .from("shifts")
    .select(
      "title, date, start_time, duration_minutes, description, companies(name, email_settings, email_templates)",
    )
    .eq("id", shiftId)
    .single();
  if (!shift) return { ok: true };

  type ShiftRow = {
    title: string;
    date: string;
    start_time: string;
    duration_minutes: number;
    description: string | null;
    companies: {
      name: string;
      email_settings: EmailSettings | null;
      email_templates: EmailTemplates | null;
    } | null;
  };
  const shiftRow = shift as unknown as ShiftRow;
  if (!emailEnabled(shiftRow.companies?.email_settings, "shiftAssigned")) return { ok: true };

  return sendShiftAssignedEmail(
    person.email,
    {
      title: shiftRow.title,
      date: shiftRow.date,
      startTime: shiftRow.start_time,
      endTime: endTime(shiftRow.start_time, shiftRow.duration_minutes),
      companyName: shiftRow.companies?.name ?? null,
      description: shiftRow.description,
    },
    shiftRow.companies?.email_templates?.shiftAssigned ?? null,
  );
}

// Best-effort notification after a reviewLeave() approve/deny call. Same
// no-op-on-{ ok: true } contract as notifyShiftAssigned — an email hiccup
// must never surface as a failure for a review that already succeeded.
export async function notifyLeaveReviewed(
  leaveRequestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole(["manager", "company_admin"]);
  if (!profile.companyId) return { ok: false, error: "No company context." };

  const supabase = await createClient(); // RLS-scoped — cross-company id silently returns null, safe no-op

  const { data: request } = await supabase
    .from("leave_requests")
    .select("person_id, type, start_date, end_date, status, reviewer_comment")
    .eq("id", leaveRequestId)
    .single();
  if (!request || (request.status !== "approved" && request.status !== "denied")) {
    return { ok: true };
  }

  const { data: person } = await supabase
    .from("people")
    .select("email, status")
    .eq("id", request.person_id)
    .single();
  if (!person?.email || person.status !== "active") return { ok: true };

  const { data: company } = await supabase
    .from("companies")
    .select("name, email_settings, email_templates")
    .eq("id", profile.companyId)
    .single();
  if (!emailEnabled(company?.email_settings, "leaveReviewed")) return { ok: true };
  const companyEmailTemplates = company?.email_templates as EmailTemplates | null | undefined;

  return sendLeaveReviewedEmail(
    person.email,
    {
      type: request.type,
      startDate: request.start_date,
      endDate: request.end_date,
      status: request.status,
      reviewerComment: request.reviewer_comment,
      companyName: company?.name ?? null,
    },
    companyEmailTemplates?.leaveReviewed ?? null,
  );
}

// Best-effort notification after a reviewShiftAdjustment() approve/deny call.
// Same no-op-on-{ ok: true } contract as notifyLeaveReviewed — an email hiccup
// must never surface as a failure for a review that already succeeded.
export async function notifyShiftAdjustmentReviewed(
  adjustmentRequestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole(["manager", "company_admin"]);
  if (!profile.companyId) return { ok: false, error: "No company context." };

  const supabase = await createClient(); // RLS-scoped — cross-company id silently returns null, safe no-op

  const { data: request } = await supabase
    .from("shift_adjustment_requests")
    .select("person_id, adjustment_type, date, requested_time, status, reviewer_comment")
    .eq("id", adjustmentRequestId)
    .single();
  if (!request || (request.status !== "approved" && request.status !== "denied")) {
    return { ok: true };
  }

  const { data: person } = await supabase
    .from("people")
    .select("email, status")
    .eq("id", request.person_id)
    .single();
  if (!person?.email || person.status !== "active") return { ok: true };

  const { data: company } = await supabase
    .from("companies")
    .select("name, email_settings, email_templates")
    .eq("id", profile.companyId)
    .single();
  const key: BooleanEmailSettingKey = "shiftAdjustmentReviewed";
  if (!emailEnabled(company?.email_settings, key)) return { ok: true };
  const companyEmailTemplates = company?.email_templates as EmailTemplates | null | undefined;

  return sendShiftAdjustmentReviewedEmail(
    person.email,
    {
      adjustmentType: request.adjustment_type,
      date: request.date,
      requestedTime: request.requested_time,
      status: request.status,
      reviewerComment: request.reviewer_comment,
      companyName: company?.name ?? null,
    },
    companyEmailTemplates?.shiftAdjustmentReviewed ?? null,
  );
}

type SwapShiftRow = {
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  companies: {
    name: string;
    email_settings: EmailSettings | null;
    email_templates: EmailTemplates | null;
  } | null;
};

async function fetchSwapShiftInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string,
): Promise<
  | {
      title: string;
      date: string;
      startTime: string;
      endTime: string;
      companyName: string | null;
      companyEmailSettings: EmailSettings | null;
      companyEmailTemplates: EmailTemplates | null;
    }
  | null
> {
  const { data: shift } = await supabase
    .from("shifts")
    .select("title, date, start_time, duration_minutes, companies(name, email_settings, email_templates)")
    .eq("id", shiftId)
    .single();
  if (!shift) return null;
  const shiftRow = shift as unknown as SwapShiftRow;
  return {
    title: shiftRow.title,
    date: shiftRow.date,
    startTime: shiftRow.start_time,
    endTime: endTime(shiftRow.start_time, shiftRow.duration_minutes),
    companyName: shiftRow.companies?.name ?? null,
    companyEmailSettings: shiftRow.companies?.email_settings ?? null,
    companyEmailTemplates: shiftRow.companies?.email_templates ?? null,
  };
}

// Best-effort notification after proposeSwap(). Fires as the initiating
// employee, so role check is broader than the manager-only notify actions
// above. Safe: only reads via the RLS-scoped client, and
// shift_swap_requests_select already scopes rows to the caller's company.
export async function notifySwapProposed(swapId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["employee", "manager", "company_admin"]);
  const supabase = await createClient();

  const { data: swap } = await supabase
    .from("shift_swap_requests")
    .select("swap_type, offered_shift_id, requested_shift_id, initiator_person_id, target_person_id")
    .eq("id", swapId)
    .single();
  if (!swap) return { ok: true };

  const { data: target } = await supabase
    .from("people")
    .select("email, status")
    .eq("id", swap.target_person_id)
    .single();
  if (!target?.email || target.status !== "active") return { ok: true };

  const { data: initiator } = await supabase
    .from("people")
    .select("name")
    .eq("id", swap.initiator_person_id)
    .single();

  const offeredShift = await fetchSwapShiftInfo(supabase, swap.offered_shift_id);
  if (!offeredShift) return { ok: true };
  if (!emailEnabled(offeredShift.companyEmailSettings, "swapProposed")) return { ok: true };
  const requestedShift = swap.requested_shift_id
    ? await fetchSwapShiftInfo(supabase, swap.requested_shift_id)
    : null;

  return sendShiftSwapProposedEmail(
    target.email,
    {
      swapType: swap.swap_type,
      initiatorName: initiator?.name ?? "A coworker",
      companyName: offeredShift.companyName,
      offeredShift,
      requestedShift,
    },
    offeredShift.companyEmailTemplates?.swapProposed ?? null,
  );
}

// Best-effort notification after respondToSwap(). Same broad role list as
// notifySwapProposed — fires as the responding employee.
export async function notifySwapResponded(swapId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["employee", "manager", "company_admin"]);
  const supabase = await createClient();

  const { data: swap } = await supabase
    .from("shift_swap_requests")
    .select("swap_type, offered_shift_id, initiator_person_id, target_person_id, status")
    .eq("id", swapId)
    .single();
  if (!swap || (swap.status !== "accepted_pending_manager" && swap.status !== "declined_by_target")) {
    return { ok: true };
  }

  const { data: initiatorPerson } = await supabase
    .from("people")
    .select("email, status")
    .eq("id", swap.initiator_person_id)
    .single();
  if (!initiatorPerson?.email || initiatorPerson.status !== "active") return { ok: true };

  const { data: responder } = await supabase
    .from("people")
    .select("name")
    .eq("id", swap.target_person_id)
    .single();

  const offeredShift = await fetchSwapShiftInfo(supabase, swap.offered_shift_id);
  if (!offeredShift) return { ok: true };
  if (!emailEnabled(offeredShift.companyEmailSettings, "swapResponded")) return { ok: true };

  return sendShiftSwapRespondedEmail(
    initiatorPerson.email,
    {
      swapType: swap.swap_type,
      response: swap.status === "accepted_pending_manager" ? "accepted" : "declined",
      responderName: responder?.name ?? "Your coworker",
      companyName: offeredShift.companyName,
      offeredShift,
    },
    offeredShift.companyEmailTemplates?.swapResponded ?? null,
  );
}

// Best-effort notification after reviewSwap(). Manager-only, mirrors
// notifyLeaveReviewed. Notifies both initiator and target, each best-effort.
export async function notifySwapReviewed(swapId: string): Promise<{ ok: boolean; error?: string }> {
  await requireRole(["manager", "company_admin"]);
  const supabase = await createClient();

  const { data: swap } = await supabase
    .from("shift_swap_requests")
    .select("swap_type, offered_shift_id, initiator_person_id, target_person_id, status, reviewer_comment")
    .eq("id", swapId)
    .single();
  if (!swap || (swap.status !== "approved" && swap.status !== "denied")) {
    return { ok: true };
  }

  const offeredShift = await fetchSwapShiftInfo(supabase, swap.offered_shift_id);
  if (!offeredShift) return { ok: true };
  if (!emailEnabled(offeredShift.companyEmailSettings, "swapReviewed")) return { ok: true };

  const { data: people } = await supabase
    .from("people")
    .select("id, email, status")
    .in("id", [swap.initiator_person_id, swap.target_person_id]);

  const recipients = (people ?? []).filter((p) => p.email && p.status === "active");
  await Promise.all(
    recipients.map((p) =>
      sendShiftSwapReviewedEmail(
        p.email,
        {
          swapType: swap.swap_type,
          status: swap.status as "approved" | "denied",
          reviewerComment: swap.reviewer_comment,
          companyName: offeredShift.companyName,
          offeredShift,
        },
        offeredShift.companyEmailTemplates?.swapReviewed ?? null,
      ),
    ),
  );
  return { ok: true };
}

// Inserts an activity_entries "notified" row for the other party of a
// shift swap (proposer -> target, or target -> proposer on response/review).
// Uses the admin client because activity_entries RLS only allows self-
// inserts or manager/company_admin — a plain employee notifying the other
// party of a swap they're involved in has no RLS path otherwise. Caller's
// party-of-the-swap membership is verified via the RLS-scoped client first,
// so this can't be used to spam arbitrary people.
export async function logSwapActivity(
  swapId: string,
  targetPersonId: string,
  action: ActivityAction,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireRole(["employee", "manager", "company_admin"]);
  if (!profile.companyId || !profile.personId) {
    return { ok: false, error: "No company context." };
  }

  const supabase = await createClient();
  const { data: swap } = await supabase
    .from("shift_swap_requests")
    .select("initiator_person_id, target_person_id, company_id")
    .eq("id", swapId)
    .single();
  if (!swap) return { ok: false, error: "Swap request not found." };

  const isParty =
    (swap.initiator_person_id === profile.personId && swap.target_person_id === targetPersonId) ||
    (swap.target_person_id === profile.personId && swap.initiator_person_id === targetPersonId);
  const isManager = profile.role === "manager" || profile.role === "company_admin";
  const targetInSwap =
    targetPersonId === swap.initiator_person_id || targetPersonId === swap.target_person_id;
  if (!isParty && !(isManager && targetInSwap)) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin.from("activity_entries").insert({
    company_id: swap.company_id,
    person_id: targetPersonId,
    action,
    message,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Sample data used to render a preview of an email template (custom draft or
// hardcoded default) without actually sending anything. company_admin-only —
// same audience as the settings page this is called from.
const PREVIEW_DATE = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

function previewShiftInfo(title: string) {
  return { title, date: PREVIEW_DATE, startTime: "09:00", endTime: "17:00" };
}

export async function previewEmailTemplate(
  key: EmailTemplateKey,
  draft: EmailTemplateOverride | null,
): Promise<{ ok: true; subject: string; html: string } | { ok: false; error: string }> {
  const profile = await requireRole(["company_admin"]);
  if (!profile.companyId) return { ok: false, error: "No company context." };

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("name")
    .eq("id", profile.companyId)
    .single();
  const companyName = company?.name ?? "Roster";

  // Blank draft (not yet written) previews as the default template instead.
  const custom = draft && draft.subject.trim() && draft.html.trim() ? draft : null;

  switch (key) {
    case "shiftAssigned":
      return {
        ok: true,
        ...renderShiftAssignedEmail(
          {
            ...previewShiftInfo("Evening Shift"),
            companyName,
            description: "Cover the front register and assist with closing.",
          },
          custom,
        ),
      };
    case "shiftReminder":
      return {
        ok: true,
        ...renderShiftReminderEmail(
          {
            ...previewShiftInfo("Evening Shift"),
            companyName,
            description: "Cover the front register and assist with closing.",
          },
          custom,
        ),
      };
    case "leaveReviewed":
      return {
        ok: true,
        ...renderLeaveReviewedEmail(
          {
            type: "vacation",
            startDate: PREVIEW_DATE,
            endDate: PREVIEW_DATE,
            status: "approved",
            reviewerComment: "Enjoy your time off!",
            companyName,
          },
          custom,
        ),
      };
    case "shiftAdjustmentReviewed":
      return {
        ok: true,
        ...renderShiftAdjustmentReviewedEmail(
          {
            adjustmentType: "early_out",
            date: PREVIEW_DATE,
            requestedTime: "15:30",
            status: "approved",
            reviewerComment: "Approved, drive safe.",
            companyName,
          },
          custom,
        ),
      };
    case "swapProposed":
      return {
        ok: true,
        ...renderShiftSwapProposedEmail(
          {
            swapType: "trade",
            initiatorName: "Jamie Smith",
            companyName,
            offeredShift: previewShiftInfo("Evening Shift"),
            requestedShift: previewShiftInfo("Morning Shift"),
          },
          custom,
        ),
      };
    case "swapResponded":
      return {
        ok: true,
        ...renderShiftSwapRespondedEmail(
          {
            swapType: "trade",
            response: "accepted",
            responderName: "Jamie Smith",
            companyName,
            offeredShift: previewShiftInfo("Evening Shift"),
          },
          custom,
        ),
      };
    case "swapReviewed":
      return {
        ok: true,
        ...renderShiftSwapReviewedEmail(
          {
            swapType: "trade",
            status: "approved",
            reviewerComment: "Approved.",
            companyName,
            offeredShift: previewShiftInfo("Evening Shift"),
          },
          custom,
        ),
      };
    case "forgotClockOut": {
      const now = Date.now();
      return {
        ok: true,
        ...renderForgotClockOutEmail(
          {
            clockInAt: new Date(now - 9 * 60 * 60 * 1000).toISOString(),
            shiftTitle: "Evening Shift",
            shiftEndAt: new Date(now - 60 * 60 * 1000).toISOString(),
            companyName,
            timezone: "America/New_York",
            clockLink: `${getSiteOrigin()}/employee/clock`,
          },
          custom,
        ),
      };
    }
  }
}
