"use client";

import { useEffect, useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import type { BreakType, Person } from "@/lib/company-data";
import { resolvePunctuality, sessionStartFor } from "@/lib/company-data/business";
import { DEFAULT_BREAK_POLICY } from "@/lib/company";
import { formatDateTime, formatDurationMinutes, localDateStr } from "@/lib/format";
import { AlertTriangleIcon, ClockIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import BreakTypeBadge from "@/components/breaks/BreakTypeBadge";
import PunctualityBadge from "@/components/timeclock/PunctualityBadge";
import { useToast } from "@/lib/toast";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface CompletedEntry {
  durationMs: number;
  note?: string;
}

interface ClockInOutPanelProps {
  person: Person;
  requireShift: boolean;
}

export default function ClockInOutPanel({ person, requireShift }: ClockInOutPanelProps) {
  const {
    shifts,
    shiftAssignments,
    clockEntries,
    addClockEntry,
    breakEntries,
    startBreak,
    endBreak,
    getBreakPolicyForPerson,
  } = useCompany();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [completed, setCompleted] = useState<CompletedEntry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [breakError, setBreakError] = useState<string | null>(null);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [pendingBreakType, setPendingBreakType] = useState<BreakType | null>(null);
  const [endingBreak, setEndingBreak] = useState(false);
  const { pushToast } = useToast();

  const myEntries = useMemo(() => {
    return clockEntries
      .filter((c) => c.personId === person.id)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [clockEntries, person.id]);

  const latestEntry = myEntries[0] ?? null;
  const isWorking = latestEntry?.action === "in";

  const today = localDateStr(new Date());

  const todaysShift = useMemo(() => {
    const myShiftIds = new Set(
      shiftAssignments.filter((a) => a.personId === person.id).map((a) => a.shiftId),
    );
    const todays = shifts
      .filter((s) => myShiftIds.has(s.id) && s.date === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return todays[0] ?? null;
  }, [shifts, shiftAssignments, person.id, today]);

  const hasShiftToday = todaysShift !== null;

  const shiftStartMs = useMemo(() => {
    if (!todaysShift) return null;
    return new Date(`${today}T${todaysShift.startTime}:00`).getTime();
  }, [todaysShift, today]);

  useEffect(() => {
    const counting = !isWorking && shiftStartMs !== null && Date.now() < shiftStartMs;
    if (!isWorking && !counting) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(id);
  }, [isWorking, shiftStartMs]);

  const sessionBreaks = useMemo(() => {
    if (!latestEntry || latestEntry.action !== "in") return [];
    return breakEntries
      .filter((b) => b.clockEntryId === latestEntry.id)
      .sort((a, b) => b.breakInAt.localeCompare(a.breakInAt));
  }, [breakEntries, latestEntry]);

  const activeBreak = useMemo(
    () => sessionBreaks.find((b) => !b.breakOutAt) ?? null,
    [sessionBreaks],
  );

  const [policy, setPolicy] = useState(DEFAULT_BREAK_POLICY);

  useEffect(() => {
    let cancelled = false;
    getBreakPolicyForPerson(person.id).then((p) => {
      if (!cancelled) setPolicy(p);
    });
    return () => {
      cancelled = true;
    };
  }, [person.id, getBreakPolicyForPerson]);

  const mealCount = sessionBreaks.filter((b) => b.type === "meal").length;
  const restCount = sessionBreaks.filter((b) => b.type === "rest").length;
  const mealCapped = mealCount >= policy.maxMealBreaksPerShift;
  const restCapped = restCount >= policy.maxRestBreaksPerShift;

  const handleClockIn = async () => {
    if (clockingIn) return;
    setError(null);
    setCompleted(null);
    if (requireShift && !hasShiftToday) {
      setError("No shift assigned today — contact your manager.");
      return;
    }
    setClockingIn(true);
    try {
      await addClockEntry(person.id, "in");
      pushToast({ tone: "success", message: "Clocked in" });
    } finally {
      setClockingIn(false);
    }
  };

  const handleClockOut = async () => {
    if (!latestEntry || clockingOut) return;
    setClockingOut(true);
    try {
      const durationMs = Date.now() - new Date(latestEntry.at).getTime();
      await addClockEntry(person.id, "out", note || undefined);
      setCompleted({ durationMs, note: note || undefined });
      pushToast({ tone: "success", message: "Clocked out" });
      setNote("");
      setShowNote(false);
    } finally {
      setClockingOut(false);
    }
  };

  const handleStartBreak = async (type: BreakType) => {
    if (pendingBreakType) return;
    setBreakError(null);
    setPendingBreakType(type);
    try {
      const result = await startBreak(person.id, type);
      if (!result.ok) {
        setBreakError(result.error ?? "Could not start break.");
      } else {
        pushToast({ tone: "success", message: `${type} break started` });
      }
    } finally {
      setPendingBreakType(null);
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreak || endingBreak) return;
    setBreakError(null);
    setEndingBreak(true);
    try {
      const result = await endBreak(activeBreak.id);
      if (!result.ok) {
        setBreakError(result.error ?? "Could not end break.");
      } else {
        pushToast({ tone: "success", message: "Break ended" });
      }
    } finally {
      setEndingBreak(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-weak px-4 py-3.5">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[13px] font-medium text-danger">{error}</p>
        </div>
      )}

      {!requireShift && !hasShiftToday && !isWorking && (
        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning-weak px-4 py-3.5">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-[13px] font-medium text-warning">
            No shift assigned today — clocking in without a scheduled shift.
          </p>
        </div>
      )}

      {completed && !isWorking && (
        <div className="mt-6 rounded-xl border border-success/30 bg-success-weak px-4 py-3.5">
          <p className="text-[13px] font-medium text-success">Entry completed</p>
          <p className="mt-1 text-xs text-ink-muted">
            Worked {formatElapsed(completed.durationMs)}
            {completed.note && ` · "${completed.note}"`}
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-6 text-center">
        {isWorking ? (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
              Working
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold text-ink">
              {formatElapsed(now - new Date(latestEntry.at).getTime())}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              Clocked in at {formatDateTime(latestEntry.at)}
            </p>

            {policy.enabled && (
              <div className="mx-auto mt-5 max-w-sm rounded-lg border border-hairline bg-surface-3 p-4 text-left">
                {activeBreak ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
                      On {activeBreak.type} break
                    </p>
                    <p className="mt-1.5 font-mono text-xl font-semibold text-ink">
                      {formatElapsed(now - new Date(activeBreak.breakInAt).getTime())}
                    </p>
                    <button
                      type="button"
                      onClick={handleEndBreak}
                      disabled={endingBreak}
                      className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {endingBreak && <Spinner className="size-3.5" />}
                      End break
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
                      Breaks
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartBreak("meal")}
                        disabled={mealCapped || pendingBreakType !== null}
                        className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-center text-[13px] font-medium leading-tight text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pendingBreakType === "meal" && <Spinner className="size-3.5" />}
                        Start meal break{mealCapped ? " (limit reached)" : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartBreak("rest")}
                        disabled={restCapped || pendingBreakType !== null}
                        className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-2 py-1.5 text-center text-[13px] font-medium leading-tight text-ink transition-colors hover:bg-surface-4 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {pendingBreakType === "rest" && <Spinner className="size-3.5" />}
                        Start rest break{restCapped ? " (limit reached)" : ""}
                      </button>
                    </div>
                  </>
                )}

                {breakError && (
                  <p className="mt-2 text-xs font-medium text-danger">{breakError}</p>
                )}

                {sessionBreaks.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                    {sessionBreaks.map((b) => (
                      <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
                        <BreakTypeBadge type={b.type} />
                        <span className="text-ink-subtle">
                          {b.durationMinutes !== undefined
                            ? formatDurationMinutes(b.durationMinutes)
                            : "in progress"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {showNote ? (
              <div className="mx-auto mt-5 max-w-sm text-left">
                <label className="block text-xs font-medium text-ink-muted">
                  Notes (optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Anything worth noting about this shift..."
                  className="mt-1.5 w-full rounded-lg border border-hairline bg-surface-3 px-3 py-2 text-[13px] text-ink placeholder:text-ink-subtle transition-colors focus:border-primary/60 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleClockOut}
                  disabled={clockingOut}
                  className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-danger text-[13px] font-medium text-white transition-colors hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {clockingOut && <Spinner className="size-3.5" />}
                  Save entry
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowNote(true)}
                className="mt-5 h-9 rounded-lg bg-danger px-5 text-[13px] font-medium text-white transition-colors hover:bg-danger-hover"
              >
                Clock out
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
              Not working
            </p>
            <p className="mt-2 text-[13px] text-ink-muted">
              {hasShiftToday
                ? "You have a shift scheduled today."
                : "No shift assigned today."}
            </p>
            {hasShiftToday && shiftStartMs !== null && now < shiftStartMs && (
              <p className="mt-2 font-mono text-2xl font-semibold text-ink">
                Shift starts in {formatElapsed(shiftStartMs - now)}
              </p>
            )}
            {(hasShiftToday || !requireShift) && (
              <button
                type="button"
                onClick={handleClockIn}
                disabled={clockingIn}
                className="mx-auto mt-5 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {clockingIn && <Spinner className="size-3.5" />}
                Clock in
              </button>
            )}
          </>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
        <p className="border-b border-hairline px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
          Recent activity
        </p>
        {myEntries.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <ClockIcon className="mx-auto size-8 text-ink-faint" />
            <p className="mt-2 text-[13px] font-medium text-ink">No clock entries yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-hairline/60">
            {myEntries.map((c) => {
              const punctuality = resolvePunctuality(
                c.personId,
                c.at,
                c.action,
                { shifts, shiftAssignments },
                person.timezone,
                sessionStartFor(c, clockEntries),
              );
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <ClockIcon className="size-3.5 text-ink-subtle" />
                    {c.action === "in" ? "Clocked in" : "Clocked out"}
                    {c.note && (
                      <span className="text-[11px] font-normal text-ink-subtle">
                        &middot; {c.note}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2.5">
                    {punctuality && (
                      <PunctualityBadge
                        label={punctuality.label}
                        deviationMinutes={punctuality.deviationMinutes}
                      />
                    )}
                    <span className="text-xs text-ink-subtle">
                      {formatDateTime(c.at)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
