"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import type { ClockEntry, BreakEntry } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";
import StatCard from "@/components/ui/StatCard";
import Avatar from "@/components/people/Avatar";
import BreakTypeBadge from "@/components/breaks/BreakTypeBadge";
import { ClockIcon, UsersIcon } from "@/components/ui/icons";

function fmt(time: string): string {
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function HRTimeTrackingPage() {
  const { people, clockEntries, breakEntries } = useCompany();
  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const today = localDateStr(new Date());

  const todayEntries = useMemo(
    () => clockEntries.filter((e) => e.at.startsWith(today)),
    [clockEntries, today],
  );

  const sessions = useMemo(() => {
    const map = new Map<string, { personId: string; in: ClockEntry; out?: ClockEntry }>();
    for (const e of todayEntries) {
      if (e.action === "in") {
        const key = e.id;
        map.set(key, { personId: e.personId, in: e });
      }
    }
    const outByPerson = new Map<string, ClockEntry>();
    for (const e of todayEntries) {
      if (e.action === "out") outByPerson.set(e.personId, e);
    }
    const result = Array.from(map.values())
      .map((s) => ({ ...s, out: outByPerson.get(s.personId) }))
      .sort((a, b) => b.in.at.localeCompare(a.in.at));
    return result;
  }, [todayEntries]);

  const breaksByPerson = useMemo(() => {
    const map = new Map<string, BreakEntry[]>();
    for (const b of breakEntries) {
      const list = map.get(b.personId) ?? [];
      list.push(b);
      map.set(b.personId, list);
    }
    return map;
  }, [breakEntries]);

  const peopleOnShift = new Set(sessions.map((s) => s.personId)).size;
  const totalMinutes = sessions.reduce((sum, s) => {
    if (!s.out) return sum;
    const diff = new Date(s.out.at).getTime() - new Date(s.in.at).getTime();
    return sum + Math.max(0, diff / 60000);
  }, 0);
  const hoursToday = (totalMinutes / 60).toFixed(1);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Time tracking</h1>
        <p className="mt-1 text-sm text-ink-muted">Live clock-ins and breaks for today.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Clocked in today"
          value={todayEntries.filter((e) => e.action === "in").length}
          sub="clock-in events"
          icon={<ClockIcon className="size-4" />}
        />
        <StatCard
          label="People on shift"
          value={peopleOnShift}
          sub="right now"
          icon={<UsersIcon className="size-4" />}
        />
        <StatCard
          label="Hours logged"
          value={hoursToday}
          sub="across completed sessions today"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
        {sessions.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-muted">
            No clock-ins yet today.
          </p>
        ) : (
          <ul className="divide-y divide-hairline">
            {sessions.map((s) => {
              const person = personMap.get(s.personId);
              const breaks = breaksByPerson.get(s.personId) ?? [];
              return (
                <li key={s.in.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person?.name ?? "?"} src={person?.avatarUrl} className="size-8 text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{person?.email}</p>
                  </div>
                  <div className="hidden items-center gap-1 sm:flex">
                    {breaks.map((b) => (
                      <span key={b.id} className="flex items-center gap-1">
                        <BreakTypeBadge type={b.type} />
                        {b.durationMinutes != null && (
                          <span className="text-xs text-ink-subtle">
                            {b.durationMinutes}m
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-medium text-ink">In {fmt(s.in.at)}</p>
                    <p className="text-xs text-ink-muted">
                      {s.out ? `Out ${fmt(s.out.at)}` : "Still clocked in"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}