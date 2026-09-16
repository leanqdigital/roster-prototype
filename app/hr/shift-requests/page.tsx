"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import Avatar from "@/components/people/Avatar";

function endTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default function HRShiftRequestsPage() {
  const { shiftAssignments, shifts, people } = useCompany();
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const pending = useMemo(
    () =>
      shiftAssignments
        .filter((a) => a.status === "pending")
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [shiftAssignments],
  );

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Shift requests</h1>
        <p className="mt-1 text-sm text-ink-muted">
          People requesting shifts, waiting on a manager.
        </p>
      </div>

      {pending.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No pending shift requests</p>
          <p className="mt-1 text-xs text-ink-muted">
            When staff pick up shifts, pending requests appear here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {pending.map((a) => {
              const person = personMap.get(a.personId);
              const shift = shiftMap.get(a.shiftId);
              if (!shift) return null;
              return (
                <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person?.name ?? "?"} src={person?.avatarUrl} className="size-8 text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"} → {shift.title}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {shift.date} · {shift.startTime}–{endTime(shift.startTime, shift.durationMinutes)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-hairline bg-surface-3 px-2 py-0.5 text-xs font-medium text-ink-subtle">
                    pending approval
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}