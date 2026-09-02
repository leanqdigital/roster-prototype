import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendShiftReminderEmail } from "@/lib/email";
import { zonedTimeToUtc } from "@/lib/timezone";

// Vercel Cron hits this route (see vercel.json) once a minute. Auth via
// CRON_SECRET — Vercel auto-sends `Authorization: Bearer $CRON_SECRET` when
// that env var is set on the project.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select("id, title, date, start_time, duration_minutes, description, companies(name)")
    .eq("status", "published")
    .is("reminder_sent_at", null)
    .in("date", [todayStr, tomorrowStr]);

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

    const { data: assignments, error: assignmentsError } = await supabase
      .from("shift_assignments")
      .select("person_id, people(email, timezone, status)")
      .eq("shift_id", shift.id)
      .eq("status", "approved");

    if (assignmentsError) continue;

    type AssigneeRow = {
      person_id: string;
      people: { email: string; timezone: string | null; status: string } | null;
    };

    const assignees = ((assignments ?? []) as unknown as AssigneeRow[]).filter(
      (a) => a.people?.status === "active",
    );

    if (assignees.length === 0) continue;

    const due: AssigneeRow[] = [];
    const late: AssigneeRow[] = [];
    let anyPending = false; // not yet in window, and not stale — keep waiting

    for (const assignee of assignees) {
      const person = assignee.people!;
      const shiftStartUtc = zonedTimeToUtc(shift.date, shift.start_time, person.timezone || "UTC");
      const diffMin = (shiftStartUtc.getTime() - Date.now()) / 60000;

      if (diffMin > 10) {
        anyPending = true; // too early — next run
      } else if (diffMin > -5) {
        due.push(assignee); // on-time window
      } else if (diffMin > -LATE_GRACE_MINUTES) {
        late.push(assignee); // missed window, still within grace period
      }
      // else: more than LATE_GRACE_MINUTES past start — too stale, skip
    }

    if (due.length === 0 && late.length === 0) {
      if (anyPending) continue; // nobody due yet, wait for a later run
      // everyone is either already handled elsewhere or too stale — mark
      // sent below without emailing, so this shift stops being reprocessed
    }

    const toNotify = [...due, ...late];

    for (const assignee of toNotify) {
      const person = assignee.people!;
      const shiftRow = shift as unknown as ShiftRow;
      const result = await sendShiftReminderEmail(person.email, {
        title: shiftRow.title,
        date: shiftRow.date,
        startTime: shiftRow.start_time,
        endTime: endTime(shiftRow.start_time, shiftRow.duration_minutes),
        companyName: shiftRow.companies?.name ?? null,
        description: shiftRow.description,
      });
      if (result.ok) sent += 1;
    }

    await supabase
      .from("shifts")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", shift.id);
  }

  return Response.json({ ok: true, processed, sent });
}
