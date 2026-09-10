import { createEvents, type DateArray, type EventAttributes } from "ics";
import { zonedTimeToUtc } from "@/lib/timezone";
import type {
  Location,
  Person,
  Shift,
  ShiftAssignment,
  Team,
} from "@/lib/company-data/types";

function toUtcDateArray(date: Date): DateArray {
  return [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ];
}

function resolveLocation(team: Team | undefined, locations: Location[]): string | undefined {
  if (!team?.locationId) return undefined;
  const location = locations.find((l) => l.id === team.locationId);
  if (!location) return undefined;
  return location.address ? `${location.name}, ${location.address}` : location.name;
}

export function buildIcsForPerson({
  shifts,
  assignments,
  person,
  teams,
  locations,
  fromDate,
}: {
  shifts: Shift[];
  assignments: ShiftAssignment[];
  person: Person;
  teams: Team[];
  locations: Location[];
  fromDate: string;
}): { ok: boolean; ics?: string; error?: string; eventCount: number } {
  const approvedShiftIds = new Set(
    assignments
      .filter((a) => a.personId === person.id && a.status === "approved")
      .map((a) => a.shiftId),
  );

  const upcomingShifts = shifts
    .filter((s) => s.status === "published" && s.date >= fromDate && approvedShiftIds.has(s.id))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

  if (upcomingShifts.length === 0) {
    return { ok: false, error: "No upcoming approved shifts to export.", eventCount: 0 };
  }

  const assignmentByShiftId = new Map<string, ShiftAssignment>();
  for (const a of assignments) {
    if (a.personId === person.id && a.status === "approved") {
      assignmentByShiftId.set(a.shiftId, a);
    }
  }

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const events: EventAttributes[] = upcomingShifts.map((shift) => {
    const assignment = assignmentByShiftId.get(shift.id)!;
    const team = teamMap.get(shift.teamId);
    const startUtc = zonedTimeToUtc(shift.date, shift.startTime, person.timezone || "UTC");
    const location = resolveLocation(team, locations);

    const event: EventAttributes = {
      uid: `${shift.id}-${assignment.id}@roster.app`,
      start: toUtcDateArray(startUtc),
      startInputType: "utc",
      startOutputType: "utc",
      duration: { minutes: shift.durationMinutes },
      title: shift.title,
      status: "CONFIRMED",
    };
    if (shift.description) event.description = shift.description;
    if (location) event.location = location;
    return event;
  });

  const { error, value } = createEvents(events);
  if (error || !value) {
    return { ok: false, error: error?.message ?? "Failed to generate calendar file.", eventCount: 0 };
  }

  return { ok: true, ics: value, eventCount: events.length };
}

export function downloadIcsFile(icsContent: string, filename: string): void {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
