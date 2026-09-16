"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { isUnassigned } from "@/lib/hr";
import AdjustmentStatusBadge from "@/components/adjustments/AdjustmentStatusBadge";
import Avatar from "@/components/people/Avatar";

export default function HRAdjustmentsPage() {
  const { shiftAdjustmentRequests, people, teams, approveShiftAdjustment, denyShiftAdjustment } = useCompany();
  const { user } = useAuth();
  const { pushToast } = useToast();

  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);

  const sorted = useMemo(
    () =>
      [...shiftAdjustmentRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [shiftAdjustmentRequests],
  );

  const act = async (id: string, status: "approved" | "denied") => {
    const res = await (status === "approved"
      ? approveShiftAdjustment(id, user?.name ?? "HR")
      : denyShiftAdjustment(id, user?.name ?? "HR"));
    pushToast({
      tone: res.ok ? "success" : "danger",
      message: res.ok ? `Request ${status}` : res.error ?? "Failed to review",
    });
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Adjustments</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Late-in and early-out requests across the company. You review requests
          from staff with no manager assigned.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No adjustment requests</p>
          <p className="mt-1 text-xs text-ink-muted">Requests will show up here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {sorted.map((r) => {
              const person = personMap.get(r.personId);
              const reviewable = r.status === "pending" && !!person && isUnassigned(person, teams);
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={person?.name ?? "?"} src={person?.avatarUrl} className="size-8 text-xs font-semibold" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {r.adjustmentType === "late_in" ? "Late in" : "Early out"} · {r.date} ·{" "}
                      {r.requestedTime}
                    </p>
                  </div>
                  <AdjustmentStatusBadge status={r.status} />
                  {reviewable && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => act(r.id, "denied")}
                        className="h-8 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] font-medium text-ink hover:bg-surface-1"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        onClick={() => act(r.id, "approved")}
                        className="h-8 rounded-lg bg-primary px-3 text-[13px] font-medium text-white hover:bg-primary-hover"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}