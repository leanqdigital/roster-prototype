"use client";

import { useState } from "react";
import { useCompany } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import type { ReportFilters } from "./types";
import AttendanceReport from "./AttendanceReport";
import LeaveReport from "./LeaveReport";
import CoverageReport from "./CoverageReport";

const inputClass =
  "h-9 rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary sm:h-8";

type TabKey = "attendance" | "leave" | "coverage";

export default function ReportsView({
  teamId = "all",
  personId = "all",
  lockTeam = false,
  lockPerson = false,
  hideCoverage = false,
  title = "Reports",
  subtitle = "Attendance, leave, and coverage across your company",
}: {
  teamId?: string;
  personId?: string;
  lockTeam?: boolean;
  lockPerson?: boolean;
  hideCoverage?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { teams, people } = useCompany();
  const [tab, setTab] = useState<TabKey>("attendance");
  const [filters, setFilters] = useState<ReportFilters>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return {
      rangeStart: localDateStr(start),
      rangeEnd: localDateStr(end),
      teamId,
      personId,
    };
  });

  const set = (patch: Partial<ReportFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  // Pinned filters override whatever the UI would otherwise allow.
  const effective: ReportFilters = {
    ...filters,
    teamId: lockTeam ? teamId : filters.teamId,
    personId: lockPerson ? personId : filters.personId,
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "attendance", label: "Attendance" },
    { key: "leave", label: "Leave" },
  ];
  if (!hideCoverage) tabs.push({ key: "coverage", label: "Coverage" });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-3 p-1">
            {tabs.map((t) => (
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
        {!lockTeam && (
          <select
            value={effective.teamId}
            onChange={(e) => set({ teamId: e.target.value, personId: "all" })}
            className={inputClass}
          >
            <option value="all">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        {tab === "leave" && !lockPerson && (
          <select
            value={effective.personId}
            onChange={(e) => set({ personId: e.target.value })}
            className={inputClass}
          >
            <option value="all">All members</option>
            {people
              .filter(
                (p) =>
                  effective.teamId === "all" ||
                  p.teamIds.includes(effective.teamId),
              )
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="mt-6">
        {tab === "attendance" && (
          <AttendanceReport
            filters={effective}
            lockedPersonId={lockPerson ? personId : undefined}
          />
        )}
        {tab === "leave" && <LeaveReport filters={effective} />}
        {tab === "coverage" && <CoverageReport filters={effective} />}
      </div>
    </div>
  );
}