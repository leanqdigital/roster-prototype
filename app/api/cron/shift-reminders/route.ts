import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShiftReminderEmail } from "@/lib/email";
import { zonedTimeToUtc } from "@/lib/timezone";

// Vercel Cron hits this route (see vercel.json) once a minute. Auth via
// CRON_SECRET — Vercel auto-sends `Authorization: Bearer $CRON_SECRET` when
// that env var is set on the project.
function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — never accept requests if unset
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(auth);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false; // timingSafeEqual requires equal length
  return timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // shift.date is a wall-clock date interpreted per-assignee timezone (each
  // assignee on the same shift can have a different timezone). A UTC
  // today/tomorrow window can miss shifts whose actual per-assignee instant
  // falls in the reminder window but whose stored date, from UTC's
  // perspective, is "yesterday" or "the day after tomorrow" (e.g. UTC-12 or
  // UTC+14 assignees). Widen the query window; the per-assignee diffMin
  // check below does the real, precise filtering.
  const now = new Date();
  const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, title, date, start_time, duration_minutes, description, companies(name)")
    .eq("status", "published")
    .gte("date", startDate)
    .lte("date", endDate);

  if (shiftsError) {
    return Response.json({ error: shiftsError.message }, { status: 500 });
  }

  type ShiftRow = {
    id: string;
    title: string;
    date: string;
    start_time: string;
    duration_minutes: number;
    description: string | null;
    companies: { name: string } | null;
  };

  function endTime(startTime: string, durationMinutes: number): string {
    const [h, m] = startTime.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return startTime;
    const total = (h * 60 + m + durationMinutes) % (24 * 60);
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // On-time reminder window: 5 min before start through 10 min after.
  // Late catch-up: if that window was missed (cron gap, transient error),
  // still notify up to LATE_GRACE_MINUTES after start. Beyond that the
  // reminder is stale — suppress the email but still mark it sent so the
  // shift isn't retried forever.
  const LATE_GRACE_MINUTES = 60;

  let processed = 0;
  let sent = 0;

  for (const shift of shifts ?? []) {
    processed += 1;

    // reminder_sent_at now lives on shift_assignments (per-assignee dedup)
    // — filtering it here means each assignee is retried independently:
    // a failed send, or an assignee still too early (different timezone),
    // no longer gets stuck behind a shift-level flag set by someone else's
    // successful send.
    const { data: assignments, error: assignmentsError } = await supabase
      .from("shift_assignments")
      .select("id, person_id, people(email, timezone, status)")
      .eq("shift_id", shift.id)
      .eq("status", "approved")
      .is("reminder_sent_at", null);

    if (assignmentsError) continue;

    type AssigneeRow = {
      id: string;
      person_id: string;
      people: { email: string; timezone: string | null; status: string } | null;
    };

    const assignees = ((assignments ?? []) as unknown as AssigneeRow[]).filter(
      (a) => a.people?.status === "active",
    );

    if (assignees.length === 0) continue;

    const due: AssigneeRow[] = [];
    const late: AssigneeRow[] = [];
    const stale: AssigneeRow[] = [];

    for (const assignee of assignees) {
      const person = assignee.people!;
      const shiftStartUtc = zonedTimeToUtc(shift.date, shift.start_time, person.timezone || "UTC");
      const diffMin = (shiftStartUtc.getTime() - Date.now()) / 60000;

      if (diffMin > 10) {
        // too early — leave reminder_sent_at null, picked up on a later run
      } else if (diffMin > -5) {
        due.push(assignee); // on-time window
      } else if (diffMin > -LATE_GRACE_MINUTES) {
        late.push(assignee); // missed window, still within grace period
      } else {
        stale.push(assignee); // too stale — suppress email, stop retrying
      }
    }

    const shiftRow = shift as unknown as ShiftRow;
    const sentIds: string[] = stale.map((a) => a.id); // mark stale as handled, no email

    for (const assignee of [...due, ...late]) {
      const person = assignee.people!;
      const result = await sendShiftReminderEmail(person.email, {
        title: shiftRow.title,
        date: shiftRow.date,
        startTime: shiftRow.start_time,
        endTime: endTime(shiftRow.start_time, shiftRow.duration_minutes),
        companyName: shiftRow.companies?.name ?? null,
        description: shiftRow.description,
      });
      if (result.ok) {
        sent += 1;
        sentIds.push(assignee.id);
      }
      // send failed: leave reminder_sent_at null so this specific assignee
      // is retried next run (still within the late-grace window)
    }

    if (sentIds.length > 0) {
      await supabase
        .from("shift_assignments")
        .update({ reminder_sent_at: new Date().toISOString() })
        .in("id", sentIds);
    }
  }

  return Response.json({ ok: true, processed, sent });
}
