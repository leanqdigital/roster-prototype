"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import Avatar from "@/components/people/Avatar";

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  employee: "Employee",
};

export default function HRPeoplePage() {
  const { people, teams, locations } = useCompany();

  const teamById = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams],
  );
  const locationById = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">People</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {people.length} {people.length === 1 ? "person" : "people"} on the roster.
          </p>
        </div>
      </div>

      {people.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No people yet</p>
          <p className="mt-1 text-xs text-ink-muted">The roster is empty.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <Avatar name={p.name} src={p.avatarUrl} className="size-8 text-xs font-semibold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-ink">{p.name}</p>
                  <p className="truncate text-xs text-ink-muted">{p.email}</p>
                </div>
                <div className="hidden min-w-0 flex-1 sm:block">
                  {p.designation && (
                    <p className="truncate text-xs text-ink-muted">{p.designation}</p>
                  )}
                </div>
                <div className="hidden w-48 truncate text-xs text-ink-muted md:block">
                  {p.teamIds.map((id) => teamById.get(id)).filter(Boolean).join(", ") || "—"}
                </div>
                <div className="hidden w-32 truncate text-xs text-ink-muted lg:block">
                  {p.locationId ? (locationById.get(p.locationId) ?? "—") : "—"}
                </div>
                <span className="hidden w-20 shrink-0 text-right text-xs font-medium text-ink-muted sm:block">
                  {ROLE_LABELS[p.role] ?? p.role}
                </span>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${
                    p.status === "active"
                      ? "border-success/25 bg-success-weak text-success"
                      : p.status === "invited"
                        ? "border-hairline bg-surface-3 text-ink-subtle"
                        : "border-danger/25 bg-danger-weak text-danger"
                  }`}
                >
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}