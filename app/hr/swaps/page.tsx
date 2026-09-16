"use client";

import { useMemo } from "react";
import { useCompany } from "@/lib/company-data";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { isUnassignedPair } from "@/lib/hr";
import SwapStatusBadge from "@/components/shifts/SwapStatusBadge";
import Avatar from "@/components/people/Avatar";

export default function HRSwapsPage() {
  const { shiftSwapRequests, shifts, people, teams, reviewSwap } = useCompany();
  const { user } = useAuth();
  const { pushToast } = useToast();

  const personMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const sorted = useMemo(
    () =>
      [...shiftSwapRequests].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [shiftSwapRequests],
  );

  const act = async (id: string, status: "approved" | "denied") => {
    const res = await reviewSwap(id, status, user?.name ?? "HR");
    pushToast({
      tone: res.ok ? "success" : "danger",
      message: res.ok ? `Swap ${status}` : res.error ?? "Failed to review",
    });
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Shift swaps</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Giveaways and trades across the company. You review swaps where
          neither party has a manager — managers handle their own teams.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No swap requests</p>
          <p className="mt-1 text-xs text-ink-muted">Swap proposals will show up here.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline">
            {sorted.map((s) => {
              const initiator = personMap.get(s.initiatorPersonId);
              const target = personMap.get(s.targetPersonId);
              const offered = shiftMap.get(s.offeredShiftId);
              const requested = s.requestedShiftId
                ? shiftMap.get(s.requestedShiftId)
                : null;
              const reviewable =
                s.status === "accepted_pending_manager" &&
                !!initiator &&
                !!target &&
                isUnassignedPair(initiator, target, teams);
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex shrink-0 items-center gap-1">
                    <Avatar name={initiator?.name ?? "?"} src={initiator?.avatarUrl} className="size-7 text-[10px] font-semibold" />
                    <span className="text-xs text-ink-subtle">↔</span>
                    <Avatar name={target?.name ?? "?"} src={target?.avatarUrl} className="size-7 text-[10px] font-semibold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {initiator?.name ?? "?"} → {target?.name ?? "?"}
                      {" · "}
                      {s.swapType === "giveaway" ? "giveaway" : "trade"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {offered?.title ?? "Unknown shift"}
                      {requested ? ` ↔ ${requested.title}` : ""}
                      {offered ? ` · ${offered.date}` : ""}
                    </p>
                  </div>
                  <SwapStatusBadge status={s.status} />
                  {reviewable && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => act(s.id, "denied")}
                        className="h-8 rounded-lg border border-hairline bg-surface-3 px-3 text-[13px] font-medium text-ink hover:bg-surface-1"
                      >
                        Deny
                      </button>
                      <button
                        type="button"
                        onClick={() => act(s.id, "approved")}
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