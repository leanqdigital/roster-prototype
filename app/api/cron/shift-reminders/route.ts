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
    let allExpired = true;

    for (const assignee of assignees) {
      const person = assignee.people!;
      const shiftStartUtc = zonedTimeToUtc(shift.date, shift.start_time, person.timezone || "UTC");
      const diffMin = (shiftStartUtc.getTime() - Date.now()) / 60000;

      if (diffMin > -5) allExpired = false;
      if (diffMin <= 10 && diffMin > -5) due.push(assignee);
    }

    if (due.length === 0 && !allExpired) continue;

    const toNotify = due.length > 0 ? due : assignees;

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
