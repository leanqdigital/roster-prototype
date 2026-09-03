"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { LeaveType } from "@/lib/company-data";
import LeaveStatusBadge from "@/components/leave/LeaveStatusBadge";
import { LEAVE_TYPES } from "@/components/leave/RequestLeaveModal";
import Pagination from "@/components/ui/Pagination";
import type { ReportFilters } from "./types";

const PAGE_SIZE = 15;

function typeLabel(type: LeaveType): string {
  return LEAVE_TYPES.find((t) => t.value === type)?.label ?? type;
}

function days(start: string, end: string): number {
  const ms =
    new Date(end + "T00:00:00").getTime() -
    new Date(start + "T00:00:00").getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

function overlaps(
  start: string,
  end: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return start <= rangeEnd && end >= rangeStart;
}

export default function LeaveReport({ filters }: { filters: ReportFilters }) {
  const { leaveRequests, people, teams } = useCompany();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rows = useMemo(
    () =>
      leaveRequests
        .filter((l) => overlaps(l.startDate, l.endDate, filters.rangeStart, filters.rangeEnd))
        .filter((l) => {
          if (filters.teamId === "all") return true;
          const p = personById.get(l.personId);
          return p?.teamIds.includes(filters.teamId) ?? false;
        })
        .filter((l) => filters.personId === "all" || l.personId === filters.personId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [leaveRequests, personById, filters],
  );

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? rows
        : rows.filter((l) => l.status === statusFilter),
    [rows, statusFilter],
  );

  // Summary over the team-filtered set (ignores status filter).
  const summary = useMemo(() => {
    const byType = new Map<LeaveType, number>();
    let totalDays = 0;
    for (const l of rows) {
      if (l.status !== "approved") continue;
      const d = days(l.startDate, l.endDate);
      byType.set(l.type, (byType.get(l.type) ?? 0) + d);
      totalDays += d;
    }
    return { byType, totalDays, pending: rows.filter((l) => l.status === "pending").length };
  }, [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["Approved days", String(summary.totalDays)],
          ["Pending", String(summary.pending)],
          ...LEAVE_TYPES.map(
            (t) => [t.label, String(summary.byType.get(t.value) ?? 0)] as const,
          ),
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-hairline bg-surface-2 px-3 py-2"
          >
            <p className="text-[11px] uppercase tracking-wide text-ink-subtle">
              {label}
            </p>
            <p className="text-[15px] font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{filtered.length} request{filtered.length === 1 ? "" : "s"}</p>
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-3 p-1">
          {["all", "pending", "approved", "denied", "cancelled"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-primary text-white"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No leave requests</p>
          <p className="mt-1 text-xs text-ink-muted">
            Nothing overlaps this date range for the selected filters.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {paged.map((l) => {
              const person = personById.get(l.personId);
              return (
                <li key={l.id} className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <LeaveStatusBadge status={l.status} />
                  </div>
                  <p className="text-xs text-ink-muted">
                    {typeLabel(l.type)} · {l.startDate} – {l.endDate} (
                    {days(l.startDate, l.endDate)}d)
                  </p>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                  <th className="px-4 py-2.5 font-medium">Person</th>
                  <th className="px-4 py-2.5 font-medium">Team</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Dates</th>
                  <th className="px-4 py-2.5 font-medium">Days</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Reviewed by</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((l) => {
                  const person = personById.get(l.personId);
                  const personTeams = person
                    ? person.teamIds
                        .map((id) => teamById.get(id)?.name)
                        .filter(Boolean)
                        .join(", ")
                    : "";
                  return (
                    <tr
                      key={l.id}
                      className="border-b border-hairline last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-ink">
                        {person?.name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 text-ink-subtle">
                        {personTeams || "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-subtle">
                        {typeLabel(l.type)}
                      </td>
                      <td className="px-4 py-3 text-ink-subtle">
                        {l.startDate} – {l.endDate}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {days(l.startDate, l.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <LeaveStatusBadge status={l.status} />
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {l.reviewedBy ?? "—"}
                      </td>
                    </tr>
                  );
                })}
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
