"use server";

import { requireRole } from "@/lib/supabase/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  sendInviteEmail,
  sendShiftAssignedEmail,
  sendLeaveReviewedEmail,
  sendShiftSwapProposedEmail,
  sendShiftSwapRespondedEmail,
  sendShiftSwapReviewedEmail,
} from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-url";

export interface InviteEmployeeInput {
  email: string;
  personId: string;
  role: "employee" | "manager";
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
  const profile = await requireRole(["manager", "company_admin"]);
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
    .select("title, date, start_time, duration_minutes, description, companies(name)")
    .eq("id", shiftId)
    .single();
  if (!shift) return { ok: true };

  type ShiftRow = {
    title: string;
    date: string;
    start_time: string;
    duration_minutes: number;
    description: string | null;
    companies: { name: string } | null;
  };
  const shiftRow = shift as unknown as ShiftRow;

  return sendShiftAssignedEmail(person.email, {
    title: shiftRow.title,
    date: shiftRow.date,
    startTime: shiftRow.start_time,
    endTime: endTime(shiftRow.start_time, shiftRow.duration_minutes),
    companyName: shiftRow.companies?.name ?? null,
    description: shiftRow.description,
  });
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
    .select("name")
    .eq("id", profile.companyId)
    .single();

  return sendLeaveReviewedEmail(person.email, {
    type: request.type,
    startDate: request.start_date,
    endDate: request.end_date,
    status: request.status,
    reviewerComment: request.reviewer_comment,
    companyName: company?.name ?? null,
  });
}

type SwapShiftRow = {
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  companies: { name: string } | null;
};

async function fetchSwapShiftInfo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shiftId: string,
): Promise<{ title: string; date: string; startTime: string; endTime: string; companyName: string | null } | null> {
  const { data: shift } = await supabase
    .from("shifts")
    .select("title, date, start_time, duration_minutes, companies(name)")
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
  const requestedShift = swap.requested_shift_id
    ? await fetchSwapShiftInfo(supabase, swap.requested_shift_id)
    : null;

  return sendShiftSwapProposedEmail(target.email, {
    swapType: swap.swap_type,
    initiatorName: initiator?.name ?? "A coworker",
    companyName: offeredShift.companyName,
    offeredShift,
    requestedShift,
  });
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

  return sendShiftSwapRespondedEmail(initiatorPerson.email, {
    swapType: swap.swap_type,
    response: swap.status === "accepted_pending_manager" ? "accepted" : "declined",
    responderName: responder?.name ?? "Your coworker",
    companyName: offeredShift.companyName,
    offeredShift,
  });
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

  const { data: people } = await supabase
    .from("people")
    .select("id, email, status")
    .in("id", [swap.initiator_person_id, swap.target_person_id]);

  const recipients = (people ?? []).filter((p) => p.email && p.status === "active");
  await Promise.all(
    recipients.map((p) =>
      sendShiftSwapReviewedEmail(p.email, {
        swapType: swap.swap_type,
        status: swap.status as "approved" | "denied",
        reviewerComment: swap.reviewer_comment,
        companyName: offeredShift.companyName,
        offeredShift,
      }),
    ),
  );
  return { ok: true };
}
