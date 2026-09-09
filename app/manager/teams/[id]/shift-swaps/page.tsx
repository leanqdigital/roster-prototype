"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import { useManager } from "@/lib/manager-team";
import type { ShiftSwapRequest } from "@/lib/company-data";
import Modal from "@/components/ui/Modal";
import { SwapIcon } from "@/components/ui/icons";
import { useTeamDetail } from "../team-detail-context";
import { useToast } from "@/lib/toast";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ManagerTeamShiftSwapsPage() {
  const { team, teamPeople } = useTeamDetail();
  const { shiftSwapRequests, shifts, people, reviewSwap } = useCompany();
  const { myPerson } = useManager();
  const { pushToast } = useToast();
  const [denyTarget, setDenyTarget] = useState<ShiftSwapRequest | null>(null);
  const [denyComment, setDenyComment] = useState("");

  const personById = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    for (const p of teamPeople) map.set(p.id, p);
    return map;
  }, [people, teamPeople]);

  const shiftById = useMemo(() => new Map(shifts.map((s) => [s.id, s])), [shifts]);

  const pendingSwaps = useMemo(() => {
    const memberIds = new Set(teamPeople.map((p) => p.id));
    return shiftSwapRequests
      .filter((r) => r.status === "accepted_pending_manager" && memberIds.has(r.initiatorPersonId))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [shiftSwapRequests, teamPeople]);

  const shiftLabel = (shiftId: string): string => {
    const s = shiftById.get(shiftId);
    if (!s) return "shift";
    return `${s.title} · ${formatShortDate(s.date)} · ${s.startTime}`;
  };

  const handleApprove = async (request: ShiftSwapRequest) => {
    const result = await reviewSwap(request.id, "approved", myPerson?.name ?? "Manager");
    if (!result.ok) {
      pushToast({ tone: "danger", message: result.error ?? "Couldn't approve swap." });
      return;
    }
    pushToast({ tone: "success", message: "Swap approved" });
  };

  const handleDeny = async () => {
    if (!denyTarget) return;
    const result = await reviewSwap(
      denyTarget.id,
      "denied",
      myPerson?.name ?? "Manager",
      denyComment.trim() || undefined,
    );
    setDenyTarget(null);
    setDenyComment("");
    if (!result.ok) {
      pushToast({ tone: "danger", message: result.error ?? "Couldn't deny swap." });
      return;
    }
    pushToast({ tone: "success", message: "Swap denied" });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {pendingSwaps.length > 0
            ? `${pendingSwaps.length} swap${pendingSwaps.length === 1 ? "" : "s"} awaiting review for ${team.name}`
            : "No swaps awaiting review"}
        </p>
      </div>

      {pendingSwaps.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <SwapIcon className="mx-auto size-11 text-ink-faint" />
          <p className="mt-3 text-sm font-medium text-ink">No pending shift swaps</p>
          <p className="mt-1 text-xs text-ink-muted">
            Once a coworker accepts a swap proposal, it will show up here for approval.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {pendingSwaps.map((r) => {
            const initiator = personById.get(r.initiatorPersonId);
            const target = personById.get(r.targetPersonId);
            return (
              <li
                key={r.id}
                className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">
                      {initiator?.name ?? "Unknown"} → {target?.name ?? "Unknown"}
                      <span className="ml-1.5 rounded bg-surface-3 px-1.5 py-px text-[10px] font-medium text-ink-subtle">
                        {r.swapType === "trade" ? "Trade" : "Give-away"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-subtle">
                      Offered: {shiftLabel(r.offeredShiftId)}
                    </p>
                    {r.requestedShiftId && (
                      <p className="text-[11px] text-ink-subtle">
                        In exchange for: {shiftLabel(r.requestedShiftId)}
                      </p>
                    )}
                    {r.initiatorComment && (
                      <p className="mt-0.5 text-[11px] text-ink-muted">{r.initiatorComment}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDenyTarget(r);
                        setDenyComment("");
                      }}
                      className="rounded-md border border-danger/25 bg-danger-weak px-2.5 py-1.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger/15"
                    >
                      Deny
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(r)}
                      className="rounded-md border border-success/25 bg-success-weak px-2.5 py-1.5 text-[11px] font-medium text-success transition-colors hover:bg-success/15"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={!!denyTarget}
        title="Deny shift swap"
        description={
          denyTarget
            ? `${personById.get(denyTarget.initiatorPersonId)?.name ?? "This person"} → ${
                personById.get(denyTarget.targetPersonId)?.name ?? "coworker"
              } — ${denyTarget.swapType === "trade" ? "trade" : "give-away"}`
            : undefined
        }
        tone="danger"
        confirmLabel="Deny swap"
        onConfirm={handleDeny}
        onClose={() => setDenyTarget(null)}
      >
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
            Comment <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            value={denyComment}
            onChange={(e) => setDenyComment(e.target.value)}
            rows={3}
            placeholder="e.g. Coverage conflict that day"
            className="w-full resize-none rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
      </Modal>
    </div>
  );
}
