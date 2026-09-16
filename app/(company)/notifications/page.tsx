"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import { formatDateTime } from "@/lib/format";
import { BellIcon } from "@/components/ui/icons";

export default function CompanyNotificationsPage() {
  const { people, activity } = useCompany();

  const personById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );

  const sorted = useMemo(
    () => [...activity].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [activity],
  );

  const unreadCount = sorted.filter((a) => !a.read).length;

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-weak text-primary">
          <BellIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Notifications
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {sorted.length} activity record{sorted.length === 1 ? "" : "s"}{" "}
            {unreadCount > 0 ? `· ${unreadCount} unread` : "· all read"}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <BellIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            No activity yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Invites, edits, leave, swaps, and shift activity across your company
            will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline/60">
            {sorted.map((a) => {
              const person = personById.get(a.personId);
              return (
                <li
                  key={a.id}
                  className={`flex items-start justify-between gap-4 px-4 py-3 ${
                    !a.read ? "bg-primary-weak/30" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                        a.read ? "bg-transparent" : "bg-primary"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-[13px] ${
                          a.read ? "text-ink-muted" : "font-medium text-ink"
                        }`}
                      >
                        {person && (
                          <span className="font-semibold text-ink">
                            {person.name} ·{" "}
                          </span>
                        )}
                        {a.message}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">
                        {formatDateTime(a.timestamp)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}