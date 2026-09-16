import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendForgotClockOutEmail } from "@/lib/email";
import { zonedTimeToUtc } from "@/lib/timezone";
import { getSiteOrigin } from "@/lib/site-url";
import type { EmailSettings } from "@/lib/company";
import type { EmailTemplates } from "@/lib/email-templates";

// Supabase pg_cron (migration 0029) fires this route every 15 minutes via
// pg_net. Auth via CRON_SECRET — same bearer-check as
// app/api/cron/shift-reminders/route.ts.
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

function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return startTime;
  const total = (h * 60 + m + durationMinutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dayKeyInTz(at: string, timeZone: string): string {
  return new Date(at).toLocaleDateString("en-CA", { timeZone });
}

const GRACE_MINUTES = 60;

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 30h window: covers a full day + 1hr grace + buffer.
  const windowStart = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();

  const { data: entries, error: entriesError } = await supabase
    .from("clock_entries")
    .select("id, person_id, company_id, action, at, forgot_clockout_notified_at")
    .gte("at", windowStart)
    .order("person_id", { ascending: true })
    .order("at", { ascending: true });

  if (entriesError) {
    return Response.json({ error: entriesError.message }, { status: 500 });
  }

  type ClockEntryRow = {
    id: string;
    person_id: string;
    company_id: string;
    action: "in" | "out";
    at: string;
    forgot_clockout_notified_at: string | null;
  };

  // Group by person_id, keep the last entry per person.
  const lastByPerson = new Map<string, ClockEntryRow>();
  for (const entry of (entries ?? []) as ClockEntryRow[]) {
    lastByPerson.set(entry.person_id, entry);
  }

  const openSessions = [...lastByPerson.values()].filter(
    (e) => e.action === "in" && e.forgot_clockout_notified_at === null,
  );

  const processed = openSessions.length;
  let sent = 0;

  if (openSessions.length === 0) {
    return Response.json({ ok: true, processed, sent });
  }

  const personIds = openSessions.map((e) => e.person_id);

  const { data: people } = await supabase
    .from("people")
    .select("id, email, status, timezone")
    .in("id", personIds);

  type PersonRow = { id: string; email: string; status: string; timezone: string | null };
  const peopleById = new Map(
    ((people ?? []) as PersonRow[])
      .filter((p) => p.status === "active")
      .map((p) => [p.id, p]),
  );

  const { data: assignments } = await supabase
    .from("shift_assignments")
    .select("person_id, shifts(title, date, start_time, duration_minutes)")
    .eq("status", "approved")
    .in("person_id", personIds);

  type AssignmentRow = {
    person_id: string;
    shifts: { title: string; date: string; start_time: string; duration_minutes: number } | null;
  };
  const assignmentsByPerson = new Map<string, AssignmentRow[]>();
  for (const a of (assignments ?? []) as unknown as AssignmentRow[]) {
    if (!a.shifts) continue;
    const list = assignmentsByPerson.get(a.person_id) ?? [];
    list.push(a);
    assignmentsByPerson.set(a.person_id, list);
  }

  const companyIds = [...new Set(openSessions.map((e) => e.company_id))];
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, email_settings, email_templates")
    .in("id", companyIds);

  type CompanyRow = {
    id: string;
    name: string;
    email_settings: EmailSettings | null;
    email_templates: EmailTemplates | null;
  };
  const companiesById = new Map(
    ((companies ?? []) as CompanyRow[]).map((c) => [c.id, c]),
  );

  const notifiedIds: string[] = [];

  for (const session of openSessions) {
    const person = peopleById.get(session.person_id);
    if (!person) continue; // inactive or missing — skip

    const tz = person.timezone || "UTC";
    const clockInDayKey = dayKeyInTz(session.at, tz);
    const clockInAt = new Date(session.at);

    // Pick the assignment whose shift.date matches the clock-in's calendar
    // day (in the person's timezone), preferring the one with start_time
    // closest to (and not after) the clock-in time.
    const candidates = assignmentsByPerson.get(session.person_id) ?? [];
    let best: AssignmentRow | null = null;
    let bestStartUtc = -Infinity;
    for (const c of candidates) {
      const shift = c.shifts!;
      if (shift.date !== clockInDayKey) continue;
      const startUtc = zonedTimeToUtc(shift.date, shift.start_time, tz).getTime();
      if (startUtc > clockInAt.getTime()) continue; // not after clock-in
      if (startUtc > bestStartUtc) {
        best = c;
        bestStartUtc = startUtc;
      }
    }

    // No matching shift assignment — can't determine "forgot" without a
    // shift to compare against.
    if (!best || !best.shifts) continue;

    const shift = best.shifts;
    const shiftEndUtc = zonedTimeToUtc(shift.date, endTime(shift.start_time, shift.duration_minutes), tz);
    const graceElapsedMin = (Date.now() - shiftEndUtc.getTime()) / 60000;
    if (graceElapsedMin < GRACE_MINUTES) continue; // still within grace period

    const company = companiesById.get(session.company_id);
    if (company?.email_settings?.forgotClockOut === false) continue; // opted out

    const result = await sendForgotClockOutEmail(
      person.email,
      {
        clockInAt: session.at,
        shiftTitle: shift.title,
        shiftEndAt: shiftEndUtc.toISOString(),
        companyName: company?.name ?? null,
        timezone: tz,
        clockLink: `${getSiteOrigin()}/employee/clock`,
      },
      company?.email_templates?.forgotClockOut ?? null,
    );

    if (result.ok) {
      sent += 1;
      notifiedIds.push(session.id);
    }
    // send failed: leave forgot_clockout_notified_at null so this session
    // is retried on a later run
  }

  if (notifiedIds.length > 0) {
    await supabase
      .from("clock_entries")
      .update({ forgot_clockout_notified_at: new Date().toISOString() })
      .in("id", notifiedIds);
  }

  return Response.json({ ok: true, processed, sent });
}
