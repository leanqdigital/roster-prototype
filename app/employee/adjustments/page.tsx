"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCompany } from "@/lib/company-data";
import RequestAdjustmentModal, {
  ADJUSTMENT_TYPES,
} from "@/components/adjustments/RequestAdjustmentModal";
import AdjustmentStatusBadge from "@/components/adjustments/AdjustmentStatusBadge";
import { ClockIcon, PlusIcon } from "@/components/ui/icons";
import { useToast } from "@/lib/toast";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function typeLabel(type: string): string {
  return ADJUSTMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function EmployeeAdjustmentsPage() {
  const { user } = useAuth();
  const { people, shiftAdjustmentRequests, cancelShiftAdjustment } = useCompany();
  const { pushToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  const myPerson = useMemo(
    () =>
      people.find(
        (p) => p.role === "employee" && p.email.toLowerCase() === user?.email.toLowerCase(),
      ) ?? null,
    [people, user?.email],
  );

  const myRequests = useMemo(() => {
    if (!myPerson) return [];
    return shiftAdjustmentRequests
      .filter((r) => r.personId === myPerson.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [shiftAdjustmentRequests, myPerson]);

  const pendingCount = myRequests.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Time adjustments
          </h1>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} waiting for review`
              : "Track your early out and late in requests"}
          </p>
        </div>
        {myPerson && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover"
          >
            <PlusIcon className="size-4" />
            Request adjustment
          </button>
        )}
      </div>

      {!myPerson ? (
        <div className="mt-8 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <ClockIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            You&apos;re not linked to a team member record yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Ask your manager to invite you with the employee role, then accept
            the invite from that email.
          </p>
        </div>
      ) : myRequests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <ClockIcon className="mx-auto size-11 text-ink-faint" />
          <h2 className="mt-3 text-[15px] font-semibold text-ink">
            No adjustment requests yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-ink-muted">
            Need to come in late or leave early? Request it here and your
            manager will review it.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {myRequests.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-hairline bg-surface-2 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">
                    {typeLabel(r.adjustmentType)}
                    <span className="text-ink-subtle">
                      {" "}· {formatShortDate(r.date)} at {r.requestedTime}
                    </span>
                  </p>
                  {r.reason && (
                    <p className="mt-0.5 truncate text-[11px] text-ink-muted">
                      {r.reason}
                    </p>
                  )}
                  {r.status === "denied" && r.reviewerComment && (
                    <p className="mt-0.5 text-[11px] text-danger">
                      Manager: {r.reviewerComment}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <AdjustmentStatusBadge status={r.status} />
                  {r.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => {
                        cancelShiftAdjustment(r.id);
                        pushToast({ tone: "success", message: "Request cancelled" });
                      }}
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

      <RequestAdjustmentModal
        open={modalOpen}
        personId={myPerson?.id ?? ""}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}