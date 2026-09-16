import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendUnderstaffedShiftEmail } from "@/lib/email";
import type { EmailSettings } from "@/lib/company";
import type { EmailTemplates } from "@/lib/email-templates";

// Same bearer-check as app/api/cron/shift-reminders/route.ts.
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

// Local calendar date (YYYY-MM-DD) in a given IANA timezone, with a day offset.
function dateInTz(tz: string, offsetDays: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const [y, m, d] = [get("year"), get("month"), get("day")].map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return startTime;
  const total = (h * 60 + m + durationMinutes) % (24 * 60);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

type ShiftRow = {
  id: string;
  company_id: string;
  team_id: string;
  title: string;
  date: string;
  start_time: string;
  duration_minutes: number;
  required_count: number;
  companies: {
    name: string;
    timezone: string;
    email_settings: EmailSettings | null;
    email_templates: EmailTemplates | null;
  } | null;
  teams: { name: string | null; manager_id: string | null } | null;
};

type Recipient = { personId: string | null; email: string; name: string };

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // shift.date is a wall-clock date interpreted per-company timezone. A
  // "tomorrow" check in UTC alone can miss shifts whose company-local
  // tomorrow falls outside the UTC day (e.g. UTC+14). Widen the query
  // window; the per-company dateInTz() check below does the precise work.
  const windowStart = dateInTz("UTC", -1);
  const windowEnd = dateInTz("UTC", 3);

  const { data: shifts, error: shiftsError } = await supabase
    .from("shifts")
    .select(
      "id, company_id, team_id, title, date, start_time, duration_minutes, required_count, understaffed_alert_sent_at, " +
        "companies(name, timezone, email_settings, email_templates), teams(name, manager_id)",
    )
    .eq("status", "published")
    .is("understaffed_alert_sent_at", null)
    .gte("date", windowStart)
    .lte("date", windowEnd);

  if (shiftsError) {
    return Response.json({ error: shiftsError.message }, { status: 500 });
  }

  const results = { checked: 0, understaffed: 0, emails: 0, notified: 0 };

  for (const shift of (shifts ?? []) as unknown as ShiftRow[]) {
    const company = shift.companies;
    if (!company) continue;

    // One-day-ahead alerts only: keep shifts whose wall-clock date is
    // tomorrow in the company's timezone.
    const tomorrow = dateInTz(company.timezone || "UTC", 1);
    if (shift.date !== tomorrow) continue;

    results.checked += 1;

    const { count: staffed, error: countError } = await supabase
      .from("shift_assignments")
      .select("id", { count: "exact", head: true })
      .eq("shift_id", shift.id)
      .eq("status", "approved");
    if (countError || staffed === null) continue;

    if (staffed >= shift.required_count) continue;
    results.understaffed += 1;

    // Recipients: team manager, managers on the team, and company admins.
    const recipientMap = new Map<string, Recipient>();

    if (shift.teams?.manager_id) {
      const { data: manager } = await supabase
        .from("people")
        .select("id, email, name, status")
        .eq("id", shift.teams.manager_id)
        .single();
      if (manager?.email && manager.status === "active") {
        recipientMap.set(manager.id, {
          personId: manager.id,
          email: manager.email,
          name: manager.name,
        });
      }
    }

    const { data: teamManagers } = await supabase
      .from("people")
      .select("id, email, name, status")
      .eq("company_id", shift.company_id)
      .eq("role", "manager")
      .contains("team_ids", [shift.team_id])
      .eq("status", "active");
    for (const m of teamManagers ?? []) {
      if (m.email) {
        recipientMap.set(m.id, { personId: m.id, email: m.email, name: m.name });
      }
    }

    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("person_id, email, name")
      .eq("company_id", shift.company_id)
      .eq("role", "company_admin");
    for (const p of adminProfiles ?? []) {
      if (p.email) {
        recipientMap.set(p.person_id ?? p.email, {
          personId: p.person_id,
          email: p.email,
          name: p.name,
        });
      }
    }

    const recipients = [...recipientMap.values()];
    if (recipients.length === 0) {
      // Nobody to tell — mark handled so this shift isn't retried forever.
      await supabase
        .from("shifts")
        .update({ understaffed_alert_sent_at: new Date().toISOString() })
        .eq("id", shift.id);
      continue;
    }

    const shiftInfo = {
      title: shift.title,
      date: shift.date,
      startTime: shift.start_time,
      endTime: endTime(shift.start_time, shift.duration_minutes),
      teamName: shift.teams?.name ?? null,
      staffedCount: staffed,
      requiredCount: shift.required_count,
      companyName: company.name ?? null,
    };

    const emailOptIn = company.email_settings?.understaffedShift ?? true;
    for (const r of recipients) {
      if (emailOptIn) {
        const result = await sendUnderstaffedShiftEmail(
          r.email,
          shiftInfo,
          company.email_templates?.understaffedShift ?? null,
        );
        if (result.ok) results.emails += 1;
        // send failed: alert is one-shot — don't hammer the mailbox; the
        // in-app notification below still reaches the same people.
      }
    }

    // In-app notification feed (activity_entries, action 'notified').
    const activityRows = recipients
      .filter((r) => r.personId)
      .map((r) => ({
        company_id: shift.company_id,
        person_id: r.personId,
        action: "notified",
        message: `Understaffed: ${shift.title} on ${formatDate(shift.date)} — ${staffed} of ${shift.required_count} staffed`,
      }));
    if (activityRows.length > 0) {
      const { error: activityError } = await supabase
        .from("activity_entries")
        .insert(activityRows);
      if (!activityError) results.notified += activityRows.length;
    }

    await supabase
      .from("shifts")
      .update({ understaffed_alert_sent_at: new Date().toISOString() })
      .eq("id", shift.id);
  }

  return Response.json({ ok: true, ...results });
}