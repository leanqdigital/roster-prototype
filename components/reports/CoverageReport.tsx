"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import Pagination from "@/components/ui/Pagination";
import type { ReportFilters } from "./types";

const PAGE_SIZE = 15;

interface CoverageRow {
  date: string;
  teamName: string;
  shifts: number;
  required: number;
  assigned: number;
  unfilled: number;
}

export default function CoverageReport({ filters }: { filters: ReportFilters }) {
  const { shifts, shiftAssignments, teams } = useCompany();
  const [page, setPage] = useState(1);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const rows = useMemo<CoverageRow[]>(() => {
    const inRange = shifts.filter(
      (s) => s.date >= filters.rangeStart && s.date <= filters.rangeEnd,
    );
    const assignedCount = new Map<string, number>();
    for (const a of shiftAssignments) {
      if (a.status === "cancelled" || a.status === "rejected") continue;
      assignedCount.set(a.shiftId, (assignedCount.get(a.shiftId) ?? 0) + 1);
    }
    const byKey = new Map<string, CoverageRow>();
    for (const s of inRange) {
      if (filters.teamId !== "all" && s.teamId !== filters.teamId) continue;
      const key = `${s.date}|${s.teamId}`;
      const row =
        byKey.get(key) ??
        ({
          date: s.date,
          teamName: teamById.get(s.teamId)?.name ?? "Unknown team",
          shifts: 0,
          required: 0,
          assigned: 0,
          unfilled: 0,
        } satisfies CoverageRow);
      const assigned = Math.min(
        assignedCount.get(s.id) ?? 0,
        s.requiredCount,
      );
      row.shifts += 1;
      row.required += s.requiredCount;
      row.assigned += assigned;
      row.unfilled += Math.max(0, s.requiredCount - assigned);
      byKey.set(key, row);
    }
    return [...byKey.values()].sort(
      (a, b) => a.date.localeCompare(b.date) || a.teamName.localeCompare(b.teamName),
    );
  }, [shifts, shiftAssignments, teamById, filters]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          required: acc.required + r.required,
          assigned: acc.assigned + r.assigned,
        }),
        { required: 0, assigned: 0 },
      ),
    [rows],
  );
  const fillRate =
    totals.required === 0
      ? "—"
      : `${Math.round((totals.assigned / totals.required) * 100)}%`;

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {[
          ["Fill rate", fillRate],
          ["Seats required", String(totals.required)],
          ["Seats filled", String(totals.assigned)],
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

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No published shifts</p>
          <p className="mt-1 text-xs text-ink-muted">
            No shifts fall in this date range for the selected filters.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {paged.map((r, i) => (
              <li key={i} className="space-y-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                    {r.teamName}
                  </p>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {r.required - r.assigned > 0 ? (
                      <span className="text-warning">
                        {r.required - r.assigned} unfilled
                      </span>
                    ) : (
                      <span className="text-success">Fully covered</span>
                    )}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <dt className="text-ink-subtle">Date</dt>
                  <dd className="text-right text-ink-muted">{r.date}</dd>
                  <dt className="text-ink-subtle">Filled / Required</dt>
                  <dd className="text-right text-ink-muted">
                    {r.assigned} / {r.required}
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Team</th>
                  <th className="px-4 py-2.5 font-medium">Shifts</th>
                  <th className="px-4 py-2.5 font-medium">Seats required</th>
                  <th className="px-4 py-2.5 font-medium">Seats filled</th>
                  <th className="px-4 py-2.5 font-medium">Unfilled</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={i} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 text-ink-subtle">{r.date}</td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {r.teamName}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{r.shifts}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.required}</td>
                    <td className="px-4 py-3 text-ink-muted">{r.assigned}</td>
                    <td
                      className={`px-4 py-3 text-[12px] font-medium ${
                        r.unfilled > 0 ? "text-warning" : "text-success"
                      }`}
                    >
                      {r.unfilled}
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
