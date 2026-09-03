"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { Person } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import Pagination from "@/components/ui/Pagination";
import type { ReportFilters } from "./types";

const PAGE_SIZE = 15;

// Day bucketing and time-of-day in the person's own timezone.
function dayKeyInTz(at: string, timeZone: string): string {
  return new Date(at).toLocaleDateString("en-CA", { timeZone });
}

function timeInTz(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(at));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fmtHours(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface AttendanceRow {
  person: Person;
  date: string;
  firstIn?: string;
  lastOut?: string;
  breakMinutes: number;
  workedMinutes: number;
  shiftTitle?: string;
  shiftStart?: string;
  status: "present" | "late" | "absent" | "leave" | "off";
}

const STATUS_META: Record<
  AttendanceRow["status"],
  { label: string; className: string }
> = {
  present: { label: "Present", className: "text-success" },
  late: { label: "Late", className: "text-warning" },
  absent: { label: "Absent", className: "text-danger" },
  leave: { label: "On leave", className: "text-primary" },
  off: { label: "Off", className: "text-ink-subtle" },
};

export default function AttendanceReport({ filters }: { filters: ReportFilters }) {
  const {
    people,
    clockEntries,
    breakEntries,
    shifts,
    shiftAssignments,
    leaveRequests,
  } = useCompany();
  const [personFilter, setPersonFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const inRangePeople = useMemo(
    () =>
      people
        .filter((p) => p.status !== "invited")
        .filter(
          (p) => filters.teamId === "all" || p.teamIds.includes(filters.teamId),
        ),
    [people, filters.teamId],
  );

  const rows = useMemo<AttendanceRow[]>(() => {
    const out: AttendanceRow[] = [];
    const shiftById = new Map(shifts.map((s) => [s.id, s]));

    for (const person of inRangePeople) {
      const tz = person.timezone || "UTC";
      const approvedLeave = leaveRequests.filter(
        (l) => l.personId === person.id && l.status === "approved",
      );
      const personShiftIds = new Set(
        shiftAssignments
          .filter(
            (a) =>
              a.personId === person.id &&
              (a.status === "approved" || a.status === "pending"),
          )
          .map((a) => a.shiftId),
      );

      const entries = clockEntries
        .filter((c) => c.personId === person.id)
        .sort((a, b) => a.at.localeCompare(b.at));
      const byDay = new Map<string, typeof entries>();
      for (const e of entries) {
        const key = dayKeyInTz(e.at, tz);
        const list = byDay.get(key) ?? [];
        list.push(e);
        byDay.set(key, list);
      }
      const breaksByDay = new Map<string, number>();
      for (const b of breakEntries) {
        if (b.personId !== person.id) continue;
        const key = dayKeyInTz(b.breakInAt, tz);
        breaksByDay.set(
          key,
          (breaksByDay.get(key) ?? 0) + (b.durationMinutes ?? 0),
        );
      }

      const cursor = new Date(filters.rangeStart + "T00:00:00");
      const end = new Date(filters.rangeEnd + "T00:00:00");
      while (cursor <= end) {
        const date = localDateStr(cursor);
        cursor.setDate(cursor.getDate() + 1);

        const onLeave = approvedLeave.some(
          (l) => l.startDate <= date && l.endDate >= date,
        );
        const dayEntries = byDay.get(date) ?? [];
        const dayShifts = [...personShiftIds]
          .map((id) => shiftById.get(id))
          .filter((s): s is NonNullable<typeof s> => !!s && s.date === date);

        if (!onLeave && dayEntries.length === 0 && dayShifts.length === 0) {
          continue; // nothing to report for this day
        }

        // Pair in/out sessions; bucket each session under its "in" day.
        let firstIn: string | undefined;
        let lastOut: string | undefined;
        let workedMinutes = 0;
        let openIn: string | null = null;
        for (const e of dayEntries) {
          if (e.action === "in") {
            openIn = e.at;
            firstIn ??= e.at;
          } else if (e.action === "out") {
            if (openIn) {
              workedMinutes += Math.max(
                0,
                Math.round(
                  (new Date(e.at).getTime() - new Date(openIn).getTime()) /
                    60000,
                ),
              );
              openIn = null;
            }
            lastOut = e.at;
          }
        }

        const primaryShift = dayShifts[0];
        let status: AttendanceRow["status"];
        if (onLeave) {
          status = "leave";
        } else if (!firstIn) {
          status = "absent";
        } else if (
          primaryShift?.startTime &&
          toMinutes(timeInTz(firstIn, tz)) >
            toMinutes(primaryShift.startTime.slice(0, 5))
        ) {
          status = "late";
        } else {
          status = "present";
        }

        out.push({
          person,
          date,
          firstIn: firstIn ? timeInTz(firstIn, tz) : undefined,
          lastOut: lastOut ? timeInTz(lastOut, tz) : undefined,
          breakMinutes: breaksByDay.get(date) ?? 0,
          workedMinutes,
          shiftTitle: primaryShift?.title,
          shiftStart: primaryShift?.startTime,
          status,
        });
      }
    }
    return out.sort(
      (a, b) =>
        a.person.name.localeCompare(b.person.name) || b.date.localeCompare(a.date),
    );
  }, [inRangePeople, clockEntries, breakEntries, shifts, shiftAssignments, leaveRequests, filters]);

  const filteredRows = useMemo(
    () =>
      personFilter === "all"
        ? rows
        : rows.filter((r) => r.person.id === personFilter),
    [rows, personFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">
          {filteredRows.length} day record{filteredRows.length === 1 ? "" : "s"}
        </p>
        <select
          value={personFilter}
          onChange={(e) => {
            setPersonFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary sm:h-8"
        >
          <option value="all">All people</option>
          {inRangePeople.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No attendance records</p>
          <p className="mt-1 text-xs text-ink-muted">
            No clock activity, shifts, or leave in this range.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {paged.map((r, i) => (
              <li key={i} className="space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                    {r.person.name}
                  </p>
                  <span
                    className={`shrink-0 text-[11px] font-medium ${STATUS_META[r.status].className}`}
                  >
                    {STATUS_META[r.status].label}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-ink-subtle">Date</dt>
                  <dd className="text-right text-ink-muted">{r.date}</dd>
                  <dt className="text-ink-subtle">In / Out</dt>
                  <dd className="text-right text-ink-muted">
                    {r.firstIn ?? "—"} – {r.lastOut ?? "—"}
                  </dd>
                  <dt className="text-ink-subtle">Worked / Break</dt>
                  <dd className="text-right text-ink-muted">
                    {fmtHours(r.workedMinutes)} / {fmtHours(r.breakMinutes)}
                  </dd>
                  {r.shiftTitle && (
                    <>
                      <dt className="text-ink-subtle">Shift</dt>
                      <dd className="text-right text-ink-muted">
                        {r.shiftTitle} ({r.shiftStart})
                      </dd>
                    </>
                  )}
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                  <th className="px-4 py-2.5 font-medium">Person</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Shift</th>
                  <th className="px-4 py-2.5 font-medium">In</th>
                  <th className="px-4 py-2.5 font-medium">Out</th>
                  <th className="px-4 py-2.5 font-medium">Worked</th>
                  <th className="px-4 py-2.5 font-medium">Break</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {r.person.name}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">{r.date}</td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {r.shiftTitle
                        ? `${r.shiftTitle} (${r.shiftStart?.slice(0, 5)})`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {r.firstIn ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {r.lastOut ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {fmtHours(r.workedMinutes)}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {fmtHours(r.breakMinutes)}
                    </td>
                    <td
                      className={`px-4 py-3 text-[12px] font-medium ${STATUS_META[r.status].className}`}
                    >
                      {STATUS_META[r.status].label}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
