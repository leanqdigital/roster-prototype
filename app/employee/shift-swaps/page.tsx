"use client";

import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import type { ShiftSwapRequest } from "@/lib/company-data";
import SwapStatusBadge from "@/components/shifts/SwapStatusBadge";
import { SwapIcon } from "@/components/ui/icons";
import { useToast } from "@/lib/toast";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function EmployeeShiftSwapsPage() {
  const { user } = useAuth();
  const { people, shifts, getSwapsInvolvingPerson, respondToSwap, cancelSwap } = useCompany();
  const { pushToast } = useToast();

  const myPerson = useMemo(
    () =>
      people.find(
        (p) => p.role === "employee" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  const mySwaps = useMemo(
    () => (myPerson ? getSwapsInvolvingPerson(myPerson.id) : []),
    [myPerson, getSwapsInvolvingPerson],
  );

  const incoming = mySwaps.filter(
    (r) => myPerson && r.targetPersonId === myPerson.id && r.status === "pending_target",
  );
  const myRequests = mySwaps.filter((r) => myPerson && r.initiatorPersonId === myPerson.id);
  const history = mySwaps.filter(
    (r) => !incoming.includes(r) && !myRequests.includes(r),
  );

  const shiftLabel = (shiftId: string): string => {
    const s = shifts.find((sh) => sh.id === shiftId);
    if (!s) return "shift";
    return `${s.title} · ${formatShortDate(s.date)} · ${s.startTime}`;
  };

  const personName = (personId: string): string =>
    people.find((p) => p.id === personId)?.name ?? "Someone";

  const handleRespond = async (request: ShiftSwapRequest, response: "accept" | "decline") => {
    if (!myPerson) return;
    const result = await respondToSwap(request.id, response, myPerson.id);
    if (!result.ok) {
      pushToast({ tone: "danger", message: result.error ?? "Couldn't respond to swap." });
      return;
    }
    pushToast({
      tone: "success",
      message: response === "accept" ? "Swap accepted — awaiting manager approval" : "Swap declined",
    });
  };

  const handleCancel = async (request: ShiftSwapRequest) => {
    if (!myPerson) return;
    const result = await cancelSwap(request.id, myPerson.name);
    if (!result.ok) {
      pushToast({ tone: "danger", message: result.error ?? "Couldn't cancel swap." });
      return;
    }
    pushToast({ tone: "success", message: "Swap request cancelled" });
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-weak text-primary">
          <SwapIcon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Shift Swaps</h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Propose a swap from your schedule, and respond to requests from coworkers here.
          </p>
        </div>
      </div>

      {!myPerson ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <SwapIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            You&apos;re not linked to a team member record yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Ask your manager to invite you with the employee role.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="text-[13px] font-semibold text-ink">
              Incoming{incoming.length > 0 ? ` (${incoming.length})` : ""}
            </h2>
            {incoming.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">Nothing waiting on your response.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {incoming.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">
                          {personName(r.initiatorPersonId)} wants to{" "}
                          {r.swapType === "trade" ? "trade" : "give away"} a shift
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
                          onClick={() => handleRespond(r, "decline")}
                          className="rounded-md border border-hairline bg-surface-3 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink"
                        >
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRespond(r, "accept")}
                          className="rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-primary-hover"
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-[13px] font-semibold text-ink">My requests</h2>
            {myRequests.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">
                Propose a swap from a shift on your schedule.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {myRequests.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">
                          {r.swapType === "trade" ? "Trade" : "Give-away"} with{" "}
                          {personName(r.targetPersonId)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          Offered: {shiftLabel(r.offeredShiftId)}
                        </p>
                        {r.requestedShiftId && (
                          <p className="text-[11px] text-ink-subtle">
                            In exchange for: {shiftLabel(r.requestedShiftId)}
                          </p>
                        )}
                        {r.status === "denied" && r.reviewerComment && (
                          <p className="mt-0.5 text-[11px] text-danger">
                            Manager: {r.reviewerComment}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <SwapStatusBadge status={r.status} />
                        {r.status === "pending_target" && (
                          <button
                            type="button"
                            onClick={() => handleCancel(r)}
                            className="rounded-md border border-hairline bg-surface-3 px-2 py-1 text-[11px] font-medium text-ink-muted transition-colors hover:bg-surface-4 hover:text-ink"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-[13px] font-semibold text-ink">History</h2>
            {history.length === 0 ? (
              <p className="mt-2 text-xs text-ink-muted">No past swaps yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {history.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-ink">
                          {r.swapType === "trade" ? "Trade" : "Give-away"} ·{" "}
                          {personName(r.initiatorPersonId)} → {personName(r.targetPersonId)}
                        </p>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          {shiftLabel(r.offeredShiftId)}
                        </p>
                      </div>
                      <SwapStatusBadge status={r.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
