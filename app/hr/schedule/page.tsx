"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { Shift } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import Modal from "@/components/ui/Modal";
import ShiftCalendar from "@/components/schedule/ShiftCalendar";
import Avatar from "@/components/people/Avatar";
import { CalendarIcon } from "@/components/ui/icons";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function HRSchedulePage() {
  const { teams, people, shifts, shiftAssignments, companyHolidays } = useCompany();
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [selected, setSelected] = useState<Shift | null>(null);

  const team = teams.find((t) => t.id === teamId) ?? null;

  const teamShifts = useMemo(
    () => (team ? shifts.filter((s) => s.teamId === team.id) : []),
    [shifts, team],
  );
  const teamAssignments = useMemo(
    () => (team ? shiftAssignments.filter((a) => teamShifts.some((s) => s.id === a.shiftId)) : []),
    [shiftAssignments, teamShifts, team],
  );
  const holidays = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of companyHolidays) {
      if (!h.isActive) continue;
      const d = new Date(h.startDate + "T00:00:00");
      const end = new Date(h.endDate + "T00:00:00");
      for (let cur = new Date(d); cur <= end; cur.setDate(cur.getDate() + 1)) {
        map.set(localDateStr(cur), h.name);
      }
    }
    return map;
  }, [companyHolidays]);

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return end;
  }, [weekStart]);

  const rangeLabel = `${MONTH_NAMES[weekStart.getMonth()]} ${weekStart.getDate()} – ${
    MONTH_NAMES[weekEnd.getMonth()]
  } ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;

  const selectedAssignments = useMemo(
    () =>
      selected
        ? shiftAssignments.filter(
            (a) => a.shiftId === selected.id && a.status === "approved",
          )
        : [],
    [selected, shiftAssignments],
  );
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Schedule</h1>
          <p className="mt-1 text-sm text-ink-muted">Read-only view of published shifts.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-hairline bg-surface-3 px-3 pr-9 text-[13px] text-ink transition-colors focus:border-primary/60 focus:outline-none"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-hairline bg-surface-2 p-1">
            <button
              type="button"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() - 7);
                setWeekStart(d);
              }}
              className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              ‹ Prev
            </button>
            <span className="min-w-32 text-center text-[13px] font-medium text-ink">
              {rangeLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                const d = new Date(weekStart);
                d.setDate(d.getDate() + 7);
                setWeekStart(d);
              }}
              className="rounded-md px-2 py-1 text-xs text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>

      {!team ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No teams yet</p>
          <p className="mt-1 text-xs text-ink-muted">Create a team to see its schedule.</p>
        </div>
      ) : (
        <div className="mt-6">
          <ShiftCalendar
            weekStart={weekStart}
            shifts={teamShifts}
            assignments={teamAssignments}
            people={people}
            holidays={holidays}
            onClickShift={setSelected}
          />
        </div>
      )}

      <Modal
        open={selected !== null}
        title={selected?.title ?? ""}
        description={selected ? `${selected.date} · ${selected.startTime}–${getEndTime(selected.startTime, selected.durationMinutes)}` : undefined}
        hideFooter
        confirmLabel=""
        onConfirm={() => setSelected(null)}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              {selectedAssignments.length} of {selected.requiredCount} slots filled
            </p>
            <ul className="space-y-2">
              {selectedAssignments.map((a) => {
                const person = personMap.get(a.personId);
                return (
                  <li key={a.id} className="flex items-center gap-2.5">
                    <Avatar name={person?.name ?? "?"} src={person?.avatarUrl} className="size-6 text-[10px] font-semibold" />
                    <span className="text-[13px] font-medium text-ink">
                      {person?.name ?? "Unassigned"}
                    </span>
                    {a.adjustedStartTime && (
                      <span className="ml-auto text-xs text-ink-subtle">
                        in {a.adjustedStartTime}
                      </span>
                    )}
                    {a.adjustedEndTime && (
                      <span className="ml-auto text-xs text-ink-subtle">
                        out {a.adjustedEndTime}
                      </span>
                    )}
                  </li>
                );
              })}
              {selectedAssignments.length === 0 && (
                <li className="py-2 text-[13px] text-ink-muted">No one assigned yet.</li>
              )}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  );
}