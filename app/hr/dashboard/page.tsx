"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCompany } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import {
  ActivityIcon,
  CalendarIcon,
  CalendarOffIcon,
  ClockIcon,
  UsersIcon,
} from "@/components/ui/icons";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dTime = d.getTime();
  if (dTime === today.getTime()) return "Today";
  if (dTime === tomorrow.getTime()) return "Tomorrow";
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function HRDashboardPage() {
  const { people, teams, shifts, shiftAssignments, leaveRequests, complianceViolations } =
    useCompany();

  const activeMembers = people.filter((p) => p.status === "active").length;
  const pendingInvites = people.filter((p) => p.status === "invited").length;
  const pendingLeave = leaveRequests.filter((r) => r.status === "pending").length;
  const openViolations = complianceViolations.filter((v) => v.status === "open").length;

  const today = localDateStr(new Date());
  const rangeStart = localDateStr(new Date());
  const weekEndDate = new Date();
  weekEndDate.setDate(weekEndDate.getDate() + 7);
  const rangeEnd = localDateStr(weekEndDate);

  const personMap = useMemo(() => {
    const map = new Map<string, (typeof people)[0]>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  const upcoming = useMemo(() => {
    const byShift = new Map<string, string[]>();
    for (const a of shiftAssignments) {
      const list = byShift.get(a.shiftId) ?? [];
      list.push(a.personId);
      byShift.set(a.shiftId, list);
    }
    return shifts
      .filter((s) => s.date >= rangeStart && s.date <= rangeEnd)
      .sort((a, b) =>
        a.date === b.date
          ? a.startTime.localeCompare(b.startTime)
          : a.date.localeCompare(b.date),
      )
      .slice(0, 8)
      .map((s) => ({
        shift: s,
        end: endTime(s.startTime, s.durationMinutes),
        names: (byShift.get(s.id) ?? [])
          .map((id) => personMap.get(id)?.name)
          .filter((n): n is string => !!n),
      }));
  }, [shifts, shiftAssignments, personMap, rangeStart, rangeEnd]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">HR dashboard</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Company-wide read-only overview — rosters, attendance, and requests.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Active staff"
          value={activeMembers}
          sub={`${teams.length} teams · ${pendingInvites} invites pending`}
          icon={<UsersIcon className="size-4" />}
        />
        <StatCard
          label="Shifts today"
          value={shifts.filter((s) => s.date === today).length}
          sub="across all teams"
          icon={<CalendarIcon className="size-4" />}
        />
        <StatCard
          label="Pending leave"
          value={pendingLeave}
          sub="awaiting manager review"
          icon={<CalendarOffIcon className="size-4" />}
        />
        <StatCard
          label="Open violations"
          value={openViolations}
          sub="compliance flags"
          icon={<ActivityIcon className="size-4" />}
          tone={openViolations > 0 ? "danger" : "default"}
        />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Upcoming shifts</h2>
          <Link
            href="/hr/schedule"
            className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
          >
            <ClockIcon className="size-3.5" />
            Open schedule
          </Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          {upcoming.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              No shifts scheduled in the next 7 days.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {upcoming.map(({ shift, end, names }) => (
                <li key={shift.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-28 shrink-0 text-[13px] font-medium text-ink">
                    {formatDayLabel(shift.date)}
                  </span>
                  <span className="w-24 shrink-0 text-xs text-ink-muted">
                    {shift.startTime}–{end}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {names.length > 0 ? names.join(", ") : "Unassigned"}
                  </span>
                  {names.length === 0 && (
                    <span className="rounded-full border border-hairline bg-surface-1 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-subtle">
                      open
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}