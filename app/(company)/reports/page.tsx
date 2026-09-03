"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import type { ReportFilters } from "@/components/reports/types";
import AttendanceReport from "@/components/reports/AttendanceReport";
import LeaveReport from "@/components/reports/LeaveReport";
import CoverageReport from "@/components/reports/CoverageReport";

const TABS = [
  { key: "attendance", label: "Attendance" },
  { key: "leave", label: "Leave" },
  { key: "coverage", label: "Coverage" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const inputClass =
  "h-9 rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary sm:h-8";

export default function ReportsPage() {
  const { teams } = useCompany();
  const [tab, setTab] = useState<TabKey>("attendance");
  const [filters, setFilters] = useState<ReportFilters>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return { rangeStart: localDateStr(start), rangeEnd: localDateStr(end), teamId: "all" };
  });

  const set = (patch: Partial<ReportFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Reports
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Attendance, leave, and coverage across your company
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-3 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                  tab === t.key
                    ? "bg-primary text-white"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="text-xs text-ink-subtle">From</label>
        <input
          type="date"
          value={filters.rangeStart}
          max={filters.rangeEnd}
          onChange={(e) => set({ rangeStart: e.target.value })}
          className={inputClass}
        />
        <label className="text-xs text-ink-subtle">To</label>
        <input
          type="date"
          value={filters.rangeEnd}
          min={filters.rangeStart}
          onChange={(e) => set({ rangeEnd: e.target.value })}
          className={inputClass}
        />
        <select
          value={filters.teamId}
          onChange={(e) => set({ teamId: e.target.value })}
          className={inputClass}
        >
          <option value="all">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {tab === "attendance" && <AttendanceReport filters={filters} />}
        {tab === "leave" && <LeaveReport filters={filters} />}
        {tab === "coverage" && <CoverageReport filters={filters} />}
      </div>
    </div>
  );
}
