"use client";

import { useMemo, useState } from "react";
import type { BreakEntry, ClockEntry, Shift } from "@/lib/company-data";
import { useCompany } from "@/lib/company-data";
import { useLiveEntries } from "@/lib/company-data/useLiveEntries";
import { minutesBetween } from "@/lib/company-data/business";
import { initials, localDateStr } from "@/lib/format";
import { ClockIcon, AlertTriangleIcon, PauseIcon } from "@/components/ui/icons";

const selectClass =
  "h-9 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] text-ink transition-colors focus:border-primary/60 focus:outline-none";

function formatClockTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatLateMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m late`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h late` : `${h}h ${m}m late`;
}

type LiveStatus = "working" | "break" | "not_clocked_in";

interface PersonLiveStatus {
  personId: string;
  status: LiveStatus;
  lastIn?: ClockEntry;
  activeBreak?: BreakEntry;
  todayShift?: Shift;
  lateMinutes?: number;
  notClockedInYet?: boolean;
}

export default function CompanyLivePage() {
  const { people, teams, shifts, shiftAssignments } = useCompany();
  const [teamId, setTeamId] = useState<string>("");
  const {
    clockEntries: liveClockEntries,
    breakEntries: liveBreakEntries,
    loading,
    lastUpdated,
  } = useLiveEntries();

  const today = localDateStr(new Date());

  const scopedPeople = useMemo(
    () => (teamId ? people.filter((p) => p.teamIds.includes(teamId)) : people),
    [people, teamId],
  );

  const statuses = useMemo<PersonLiveStatus[]>(() => {
    const now = new Date();
    return scopedPeople.map((person) => {
      const entries = liveClockEntries
        .filter((c) => c.personId === person.id)
        .sort((a, b) => b.at.localeCompare(a.at));
      const latest = entries[0];

      const todayShift = shifts.find(
        (s) =>
          s.date === today &&
          shiftAssignments.some(
            (a) => a.shiftId === s.id && a.personId === person.id && a.status === "approved",
          ),
      );

      let status: LiveStatus = "not_clocked_in";
      let activeBreak: BreakEntry | undefined;
      if (latest?.action === "in") {
        activeBreak = liveBreakEntries.find(
          (b) => b.clockEntryId === latest.id && b.breakOutAt === undefined,
        );
        status = activeBreak ? "break" : "working";
      }

      let lateMinutes: number | undefined;
      let notClockedInYet = false;
      if (todayShift) {
        const shiftStartISO = `${todayShift.date}T${todayShift.startTime}`;
        if (status !== "not_clocked_in" && latest) {
          const diff = minutesBetween(shiftStartISO, latest.at);
          if (diff > 0) lateMinutes = diff;
        } else if (status === "not_clocked_in" && now >= new Date(shiftStartISO)) {
          notClockedInYet = true;
        }
      }

      return {
        personId: person.id,
        status,
        lastIn: latest?.action === "in" ? latest : undefined,
        activeBreak,
        todayShift,
        lateMinutes,
        notClockedInYet,
      };
    });
  }, [scopedPeople, liveClockEntries, liveBreakEntries, shifts, shiftAssignments, today]);

  const statusByPerson = useMemo(
    () => new Map(statuses.map((s) => [s.personId, s])),
    [statuses],
  );

  const working = scopedPeople.filter((p) => statusByPerson.get(p.id)?.status === "working");
  const onBreak = scopedPeople.filter((p) => statusByPerson.get(p.id)?.status === "break");
  const notClockedIn = scopedPeople.filter(
    (p) => statusByPerson.get(p.id)?.status === "not_clocked_in" && statusByPerson.get(p.id)?.todayShift,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Live</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Who&apos;s clocked in, on break, or running late right now across the company.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className={selectClass}
          >
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-ink-faint">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · live`
              : "Loading…"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center text-[13px] text-ink-muted">
          Loading live status…
        </div>
      ) : scopedPeople.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center text-[13px] text-ink-muted">
          Nobody to show here.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Working now */}
          <section className="rounded-xl border border-hairline bg-surface-2">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <span className="size-1.5 rounded-full bg-success" />
              <h2 className="text-[13px] font-semibold text-ink">Working now</h2>
              <span className="text-[11px] text-ink-subtle">({working.length})</span>
            </div>
            {working.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">Nobody is clocked in.</p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {working.map((p) => {
                  const s = statusByPerson.get(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-subtle">
                          <ClockIcon className="size-3" />
                          Clocked in{s?.lastIn ? ` at ${new Date(s.lastIn.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      </div>
                      {s?.lateMinutes !== undefined && (
                        <span className="shrink-0 rounded-md border border-warning/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          {formatLateMinutes(s.lateMinutes)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* On break */}
          <section className="rounded-xl border border-hairline bg-surface-2">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <PauseIcon className="size-3.5 text-ink-subtle" />
              <h2 className="text-[13px] font-semibold text-ink">On break</h2>
              <span className="text-[11px] text-ink-subtle">({onBreak.length})</span>
            </div>
            {onBreak.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">Nobody is on break.</p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {onBreak.map((p) => {
                  const s = statusByPerson.get(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-subtle">
                          <PauseIcon className="size-3" />
                          On {s?.activeBreak?.type ?? "a"} break
                          {s?.activeBreak
                            ? ` since ${new Date(s.activeBreak.breakInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </p>
                      </div>
                      {s?.lateMinutes !== undefined && (
                        <span className="shrink-0 rounded-md border border-warning/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                          {formatLateMinutes(s.lateMinutes)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Not clocked in (only people with a shift today) */}
          <section className="rounded-xl border border-hairline bg-surface-2">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <AlertTriangleIcon className="size-3.5 text-ink-subtle" />
              <h2 className="text-[13px] font-semibold text-ink">Not clocked in</h2>
              <span className="text-[11px] text-ink-subtle">({notClockedIn.length})</span>
            </div>
            {notClockedIn.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                Everyone scheduled today is accounted for.
              </p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {notClockedIn.map((p) => {
                  const s = statusByPerson.get(p.id);
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          Shift {s?.todayShift ? formatClockTime(s.todayShift.startTime) : ""} today
                        </p>
                      </div>
                      {s?.notClockedInYet && (
                        <span className="shrink-0 rounded-md border border-danger/30 bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-danger">
                          not clocked in yet
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
