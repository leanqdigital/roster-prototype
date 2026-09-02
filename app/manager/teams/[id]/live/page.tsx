"use client";

import { useEffect, useMemo, useState } from "react";
import type { BreakEntry, ClockEntry, Shift } from "@/lib/company-data";
import { useCompany } from "@/lib/company-data";
import {
  fetchBreakEntries,
  fetchClockEntries,
} from "@/lib/company-data/queries";
import {
  resolvePunctuality,
  type Punctuality,
} from "@/lib/company-data/business";
import { initials, localDateStr } from "@/lib/format";
import { ClockIcon, AlertTriangleIcon, PauseIcon } from "@/components/ui/icons";
import PunctualityBadge from "@/components/timeclock/PunctualityBadge";
import { useTeamDetail } from "../team-detail-context";

const POLL_INTERVAL_MS = 30000;

function formatClockTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

type LiveStatus = "working" | "break" | "not_clocked_in";

interface PersonLiveStatus {
  personId: string;
  status: LiveStatus;
  lastIn?: ClockEntry;
  activeBreak?: BreakEntry;
  todayShift?: Shift;
  punctuality?: { label: Punctuality; deviationMinutes: number };
  notClockedInYet?: boolean;
}

export default function ManagerTeamLivePage() {
  const { team, teamPeople } = useTeamDetail();
  const { shifts, shiftAssignments } = useCompany();
  const [liveClockEntries, setLiveClockEntries] = useState<ClockEntry[]>([]);
  const [liveBreakEntries, setLiveBreakEntries] = useState<BreakEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [clocks, breaks] = await Promise.all([
          fetchClockEntries(),
          fetchBreakEntries(),
        ]);
        if (!cancelled) {
          setLiveClockEntries(clocks);
          setLiveBreakEntries(breaks);
          setLastUpdated(new Date());
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const today = localDateStr(new Date());

  const statuses = useMemo<PersonLiveStatus[]>(() => {
    const now = new Date();
    return teamPeople.map((person) => {
      const entries = liveClockEntries
        .filter((c) => c.personId === person.id)
        .sort((a, b) => b.at.localeCompare(a.at));
      const latest = entries[0];

      const todayShift = shifts.find(
        (s) =>
          s.teamId === team.id &&
          s.date === today &&
          shiftAssignments.some(
            (a) =>
              a.shiftId === s.id &&
              a.personId === person.id &&
              a.status === "approved",
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

      let punctuality: PersonLiveStatus["punctuality"];
      let notClockedInYet = false;
      if (
        todayShift &&
        status !== "not_clocked_in" &&
        latest?.action === "in"
      ) {
        punctuality =
          resolvePunctuality(
            person.id,
            latest.at,
            "in",
            { shifts, shiftAssignments },
            person.timezone,
          ) ?? undefined;
      } else if (
        todayShift &&
        status === "not_clocked_in" &&
        now >= new Date(`${todayShift.date}T${todayShift.startTime}`)
      ) {
        notClockedInYet = true;
      }

      return {
        personId: person.id,
        status,
        lastIn: latest?.action === "in" ? latest : undefined,
        activeBreak,
        todayShift,
        punctuality,
        notClockedInYet,
      };
    });
  }, [
    teamPeople,
    liveClockEntries,
    liveBreakEntries,
    shifts,
    shiftAssignments,
    team.id,
    today,
  ]);

  const statusByPerson = useMemo(
    () => new Map(statuses.map((s) => [s.personId, s])),
    [statuses],
  );

  const working = teamPeople.filter(
    (p) => statusByPerson.get(p.id)?.status === "working",
  );
  const onBreak = teamPeople.filter(
    (p) => statusByPerson.get(p.id)?.status === "break",
  );
  const notClockedIn = teamPeople.filter(
    (p) =>
      statusByPerson.get(p.id)?.status === "not_clocked_in" &&
      statusByPerson.get(p.id)?.todayShift,
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Live
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Who&apos;s clocked in, on break, or running late right now for{" "}
            {team.name}.
          </p>
        </div>
        <p className="text-[11px] text-ink-faint">
          {lastUpdated
            ? `Updated ${lastUpdated.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} · refreshes every 30s`
            : "Loading…"}
        </p>
      </div>

      {loading ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center text-[13px] text-ink-muted">
          Loading live status…
        </div>
      ) : teamPeople.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center text-[13px] text-ink-muted">
          Nobody is on this team yet.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Working now */}
          <section className="rounded-xl border border-hairline bg-surface-2">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <span className="size-1.5 rounded-full bg-success" />
              <h2 className="text-[13px] font-semibold text-ink">
                Working now
              </h2>
              <span className="text-[11px] text-ink-subtle">
                ({working.length})
              </span>
            </div>
            {working.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                Nobody is clocked in.
              </p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {working.map((p) => {
                  const s = statusByPerson.get(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {p.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-subtle">
                          <ClockIcon className="size-3" />
                          Clocked in
                          {s?.lastIn
                            ? ` at ${new Date(s.lastIn.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </p>
                      </div>
                      {s?.punctuality && (
                        <PunctualityBadge
                          label={s.punctuality.label}
                          deviationMinutes={s.punctuality.deviationMinutes}
                        />
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
              <span className="text-[11px] text-ink-subtle">
                ({onBreak.length})
              </span>
            </div>
            {onBreak.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-ink-muted">
                Nobody is on break.
              </p>
            ) : (
              <ul className="divide-y divide-hairline/60">
                {onBreak.map((p) => {
                  const s = statusByPerson.get(p.id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {p.name}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-subtle">
                          <PauseIcon className="size-3" />
                          On {s?.activeBreak?.type ?? "a"} break
                          {s?.activeBreak
                            ? ` since ${new Date(s.activeBreak.breakInAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                            : ""}
                        </p>
                      </div>
                      {s?.punctuality && (
                        <PunctualityBadge
                          label={s.punctuality.label}
                          deviationMinutes={s.punctuality.deviationMinutes}
                        />
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
              <h2 className="text-[13px] font-semibold text-ink">
                Not clocked in
              </h2>
              <span className="text-[11px] text-ink-subtle">
                ({notClockedIn.length})
              </span>
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
                    <li
                      key={p.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-4 text-[11px] font-semibold text-ink">
                        {initials(p.name) || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          Shift{" "}
                          {s?.todayShift
                            ? formatClockTime(s.todayShift.startTime)
                            : ""}{" "}
                          today
                        </p>
                      </div>
                      {s?.notClockedInYet && (
                        <span className="shrink-0 rounded-md border border-danger/30 bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-danger">
                          Not clocked in yet
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
