// Pure business-logic helpers — no I/O, no framework dependencies. Ported
// unchanged from the pre-Supabase lib/company-data.tsx except
// resolveBreakPolicy, which is now async (getBreakPolicy() reads company
// settings from Supabase).

import { getBreakPolicy } from "@/lib/company";
import { formatDurationMinutes } from "@/lib/format";
import { zonedTimeToUtc } from "@/lib/timezone";
import type { BreakPolicy } from "@/lib/company";
import type {
  BreakEntry,
  BreakType,
  ClockAction,
  ClockEntry,
  CompanyState,
  ComplianceViolationSeverity,
  ComplianceViolationType,
  LeaveRequest,
  Shift,
} from "./types";

// Client-side placeholder id for objects that aren't persisted yet (e.g.
// previewShifts' unpersisted preview Shift[] — real ids come from the DB
// once published).
let idCounter = 0;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_preview_${Date.now()}_${idCounter}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function shiftsOverlap(
  a: { date: string; startTime: string; durationMinutes: number },
  b: { date: string; startTime: string; durationMinutes: number },
): boolean {
  if (a.date !== b.date) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = aStart + a.durationMinutes;
  const bStart = timeToMinutes(b.startTime);
  const bEnd = bStart + b.durationMinutes;
  return aStart < bEnd && bStart < aEnd;
}

export function shiftTimesOverlap(
  aStart: string,
  aDuration: number,
  bStart: string,
  bDuration: number,
): boolean {
  const [ah, am] = aStart.split(":").map(Number);
  const [bh, bm] = bStart.split(":").map(Number);
  const a1 = ah * 60 + am;
  const b1 = bh * 60 + bm;
  return a1 < b1 + bDuration && b1 < a1 + aDuration;
}

export function hasApprovedLeaveOn(
  personId: string,
  date: string,
  leaveRequests: LeaveRequest[],
): LeaveRequest | undefined {
  return leaveRequests.find(
    (l) =>
      l.personId === personId &&
      l.status === "approved" &&
      l.startDate <= date &&
      date <= l.endDate,
  );
}

export function minutesBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

export type Punctuality =
  | "early_in"
  | "late_in"
  | "on_time_in"
  | "early_out"
  | "late_out"
  | "on_time_out";

const PUNCTUALITY_GRACE_MINUTES = 5;

// The "in" entry that opened the session an "out" entry closes — the latest
// clock-in at-or-before the out, for the same person. Undefined for "in"
// entries or when the opener isn't in the list (e.g. clipped date range).
export function sessionStartFor(
  entry: ClockEntry,
  clockEntries: ClockEntry[],
): string | undefined {
  if (entry.action !== "out") return undefined;
  return clockEntries
    .filter((c) => c.personId === entry.personId && c.action === "in" && c.at <= entry.at)
    .sort((a, b) => b.at.localeCompare(a.at))[0]?.at;
}

// Compares a clock in/out against the person's scheduled shift and labels it
// Early/Late/On Time. A clock-out is matched against the shift its session
// opened for (via sessionStartedAt from sessionStartFor); without it, a
// fallback keeps the clock-out from being labeled against a shift that
// hadn't started yet (e.g. yesterday's forgotten clock-out landing on
// today's shift). Returns null when no scheduled shift matches.
export function resolvePunctuality(
  personId: string,
  clockAt: string,
  action: ClockAction,
  state: Pick<CompanyState, "shifts" | "shiftAssignments">,
  timeZone: string,
  sessionStartedAt?: string,
): { label: Punctuality; deviationMinutes: number } | null {
  const clock = new Date(clockAt).getTime();
  if (Number.isNaN(clock)) return null;

  const candidates = state.shiftAssignments
    .filter((a) => a.personId === personId)
    .map((a) => state.shifts.find((s) => s.id === a.shiftId))
    .filter((s): s is Shift => {
      if (!s) return false;
      const shiftDay = new Date(`${s.date}T00:00:00Z`).getTime();
      return !Number.isNaN(shiftDay) && Math.abs(shiftDay - clock) <= 36 * 3600000;
    });
  if (candidates.length === 0) return null;

  const bounds = candidates.map((s) => {
    const start = zonedTimeToUtc(s.date, s.startTime, timeZone).getTime();
    return { start, end: start + s.durationMinutes * 60000 };
  });

  const target = action === "in" ? ("start" as const) : ("end" as const);
  let best: { start: number; end: number };
  if (action === "out" && sessionStartedAt) {
    const sessionStart = new Date(sessionStartedAt).getTime();
    if (Number.isNaN(sessionStart)) return null;
    best = bounds.reduce((a, b) =>
      Math.abs(sessionStart - a.start) <= Math.abs(sessionStart - b.start) ? a : b,
    );
  } else {
    const eligible =
      action === "out"
        ? bounds.filter(
            (b) => clock - b.start >= PUNCTUALITY_GRACE_MINUTES * 60000,
          )
        : bounds;
    if (eligible.length === 0) return null;
    best = eligible.reduce((a, b) =>
      Math.abs(clock - a[target]) <= Math.abs(clock - b[target]) ? a : b,
    );
  }

  const deviationMinutes = Math.round((clock - best[target]) / 60000);
  const g = PUNCTUALITY_GRACE_MINUTES;
  const label: Punctuality =
    deviationMinutes < -g
      ? action === "in"
        ? "early_in"
        : "early_out"
      : deviationMinutes > g
        ? action === "in"
          ? "late_in"
          : "late_out"
        : action === "in"
          ? "on_time_in"
          : "on_time_out";
  return { label, deviationMinutes };
}

export async function resolveBreakPolicy(
  state: CompanyState,
  personId: string,
  sessionAtISO: string,
): Promise<BreakPolicy> {
  const base = await getBreakPolicy();
  const sessionDate = sessionAtISO.slice(0, 10);
  const assignment = state.shiftAssignments.find((a) => {
    if (a.personId !== personId) return false;
    const shift = state.shifts.find((s) => s.id === a.shiftId);
    return shift?.date === sessionDate;
  });
  const shift = assignment
    ? state.shifts.find((s) => s.id === assignment.shiftId)
    : undefined;
  const template = shift?.templateId
    ? state.shiftTemplates.find((t) => t.id === shift.templateId)
    : undefined;
  return template?.breakPolicyOverride
    ? { ...base, ...template.breakPolicyOverride }
    : base;
}

export function inferBreakType(
  sessionMinutes: number,
  existingTypes: BreakType[],
  policy: BreakPolicy,
): BreakType {
  if (sessionMinutes >= policy.mealBreakThresholdMinutes && !existingTypes.includes("meal")) {
    return "meal";
  }
  return "rest";
}

export function evaluateBreakCompliance(
  sessionMinutes: number,
  breaks: BreakEntry[],
  policy: BreakPolicy,
): { type: ComplianceViolationType; severity: ComplianceViolationSeverity; description: string }[] {
  const violations: {
    type: ComplianceViolationType;
    severity: ComplianceViolationSeverity;
    description: string;
  }[] = [];

  if (!policy.enabled) return violations;

  if (sessionMinutes >= policy.mealBreakThresholdMinutes) {
    const mealBreaks = breaks.filter((b) => b.type === "meal" && b.durationMinutes !== undefined);
    if (mealBreaks.length === 0) {
      violations.push({
        type: "meal_break_missing",
        severity: "critical",
        description: `No meal break taken during a ${Math.round(sessionMinutes / 60)}h+ shift.`,
      });
    } else if (!mealBreaks.some((b) => (b.durationMinutes ?? 0) >= policy.mealBreakMinMinutes)) {
      violations.push({
        type: "meal_break_too_short",
        severity: "warning",
        description: `Meal break(s) taken but none reached the ${formatDurationMinutes(policy.mealBreakMinMinutes)} minimum.`,
      });
    }
  }

  if (sessionMinutes >= policy.restBreakThresholdMinutes) {
    const restBreaks = breaks.filter((b) => b.type === "rest" && b.durationMinutes !== undefined);
    if (restBreaks.length === 0) {
      violations.push({
        type: "rest_break_missing",
        severity: "critical",
        description: `No rest break taken during a ${Math.round(sessionMinutes / 60)}h+ shift.`,
      });
    } else if (!restBreaks.some((b) => (b.durationMinutes ?? 0) >= policy.restBreakMinMinutes)) {
      violations.push({
        type: "rest_break_too_short",
        severity: "warning",
        description: `Rest break(s) taken but none reached the ${formatDurationMinutes(policy.restBreakMinMinutes)} minimum.`,
      });
    }
  }

  return violations;
}
