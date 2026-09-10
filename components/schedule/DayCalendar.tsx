"use client";

import { useMemo } from "react";
import type { Person, Shift, ShiftAssignment } from "@/lib/company-data";
import { shiftsOverlap } from "@/lib/company-data/business";
import { localDateStr } from "@/lib/format";

const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function dateKey(d: Date): string {
  return localDateStr(d);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface DayCalendarProps {
  date: Date;
  shifts: Shift[];
  assignments: ShiftAssignment[];
  people: Person[];
  onClickShift: (shift: Shift) => void;
  onAddShift?: (date: string) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (shift: Shift) => void;
}

export default function DayCalendar({
  date,
  shifts,
  assignments,
  people,
  onClickShift,
  onAddShift,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: DayCalendarProps) {
  const today = localDateStr(new Date());
  const key = dateKey(date);
  const isToday = key === today;

  const personMap = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of people) map.set(p.id, p);
    return map;
  }, [people]);

  const dayShifts = useMemo(() => {
    return shifts
      .filter((s) => s.date === key)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [shifts, key]);

  const assignmentCountByShift = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of assignments) {
      map.set(a.shiftId, (map.get(a.shiftId) ?? 0) + 1);
    }
    return map;
  }, [assignments]);

  const assignedPersonIdsByShift = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of assignments) {
      const list = map.get(a.shiftId) ?? [];
      list.push(a.personId);
      map.set(a.shiftId, list);
    }
    return map;
  }, [assignments]);

  const conflictShiftIds = useMemo(() => {
    const shiftMap = new Map(shifts.map((s) => [s.id, s]));
    const shiftsByPerson = new Map<string, Shift[]>();
    for (const a of assignments) {
      const shift = shiftMap.get(a.shiftId);
      if (!shift) continue;
      const list = shiftsByPerson.get(a.personId) ?? [];
      list.push(shift);
      shiftsByPerson.set(a.personId, list);
    }
    const conflicts = new Set<string>();
    for (const personShifts of shiftsByPerson.values()) {
      for (let i = 0; i < personShifts.length; i++) {
        for (let j = i + 1; j < personShifts.length; j++) {
          if (shiftsOverlap(personShifts[i], personShifts[j])) {
            conflicts.add(personShifts[i].id);
            conflicts.add(personShifts[j].id);
          }
        }
      }
    }
    return conflicts;
  }, [assignments, shifts]);

  const dateLabel =
    FULL_DAY_NAMES[date.getDay()] +
    ", " +
    MONTH_NAMES[date.getMonth()] +
    " " +
    date.getDate() +
    ", " +
    date.getFullYear();

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface-2">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 ${
          isToday ? "bg-primary-weak/40" : ""
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex size-9 items-center justify-center rounded-lg text-[18px] font-semibold ${
              isToday
                ? "bg-primary text-white"
                : "bg-surface-3 text-ink"
            }`}
          >
            {date.getDate()}
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">{dateLabel}</p>
            <p className="text-[11px] text-ink-subtle">
              {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        {onAddShift && (
          <button
            type="button"
            onClick={() => onAddShift(key)}
            className="rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-3"
          >
            + Add shift
          </button>
        )}
      </div>

      {/* Shifts list */}
      <div className="border-t border-hairline">
        {dayShifts.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[13px] text-ink-faint">No shifts this day</p>
            {onAddShift && (
              <button
                type="button"
                onClick={() => onAddShift(key)}
                className="mt-2 text-[12px] font-medium text-primary hover:text-primary-hover"
              >
                Add a shift
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-hairline/60">
            {dayShifts.map((shift) => {
              const count = assignmentCountByShift.get(shift.id) ?? 0;
              const assignedIds =
                assignedPersonIdsByShift.get(shift.id) ?? [];
              const assignedNames = assignedIds
                .map((id) => personMap.get(id)?.name)
                .filter(Boolean)
                .slice(0, 5);
              const overflow = assignedIds.length - 5;
              const isUnderstaffed = count < shift.requiredCount;
              const hasConflict = conflictShiftIds.has(shift.id);
              const isSelected =
                selectMode && selectedIds?.has(shift.id);

              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() =>
                    selectMode
                      ? onToggleSelect?.(shift)
                      : onClickShift(shift)
                  }
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "bg-primary-weak/40"
                      : isUnderstaffed
                        ? "bg-warning-weak/30 hover:bg-warning-weak/50"
                        : "hover:bg-surface-3"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-ink">
                          {shift.title}
                        </p>
                        {hasConflict && (
                          <span className="rounded-md border border-danger/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                            Conflict
                          </span>
                        )}
                        {isUnderstaffed && (
                          <span className="rounded-md border border-warning/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                            Understaffed
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink-subtle">
                        {shift.startTime} –{" "}
                        {getEndTime(shift.startTime, shift.durationMinutes)}
                        {" · "}
                        {formatDuration(shift.durationMinutes)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                        isSelected
                          ? "border-primary/40 bg-surface-2 text-primary"
                          : isUnderstaffed
                            ? "border-warning/30 bg-surface-2 text-warning"
                            : "border-hairline bg-surface-2 text-ink-muted"
                      }`}
                    >
                      {selectMode
                        ? isSelected
                          ? "✓"
                          : ""
                        : `${count}/${shift.requiredCount}`}
                    </span>
                  </div>
                  {assignedNames.length > 0 && !selectMode && (
                    <p className="mt-1.5 truncate text-[11px] text-ink-subtle">
                      {assignedNames.join(", ")}
                      {overflow > 0 && ` +${overflow}`}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
