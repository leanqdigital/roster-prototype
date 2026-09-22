"use client";

import { useMemo, useState } from "react";
import { useCompany } from "@/lib/company-data";
import { useManager } from "@/lib/manager-team";
import type { ShiftAdjustmentRequest } from "@/lib/company-data";
import Modal from "@/components/ui/Modal";
import AdjustmentStatusBadge from "@/components/adjustments/AdjustmentStatusBadge";
import { ADJUSTMENT_TYPES } from "@/components/adjustments/RequestAdjustmentModal";
import { useTeamDetail } from "../team-detail-context";
import { useToast } from "@/lib/toast";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function typeLabel(type: string): string {
  return ADJUSTMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function ManagerTeamAdjustmentsPage() {
  const { team, teamPeople } = useTeamDetail();
  const {
    shiftAdjustmentRequests,
    people,
    approveShiftAdjustment,
    denyShiftAdjustment,
    revertShiftAdjustmentApproval,
  } = useCompany();
  const { myPerson } = useManager();
  const { pushToast } = useToast();
  const [denyTarget, setDenyTarget] = useState<ShiftAdjustmentRequest | null>(null);
  const [denyComment, setDenyComment] = useState("");

  const teamRequests = useMemo(() => {
    const memberIds = new Set(teamPeople.map((p) => p.id));
    if (team.managerId) memberIds.add(team.managerId);
    return shiftAdjustmentRequests
      .filter(
        (r) =>
          memberIds.has(r.personId) &&
          myPerson && r.personId !== myPerson.id,
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [shiftAdjustmentRequests, teamPeople, team.managerId, myPerson]);

  const personById = useMemo(() => {
    const map = new Map(people.map((p) => [p.id, p]));
    for (const p of teamPeople) map.set(p.id, p);
    return map;
  }, [people, teamPeople]);

  const pendingCount = teamRequests.filter((r) => r.status === "pending").length;

  const handleApprove = (request: ShiftAdjustmentRequest) => {
    approveShiftAdjustment(request.id, myPerson?.name ?? "Manager");
    pushToast({ tone: "success", message: "Adjustment approved" });
  };

  const handleDeny = () => {
    if (!denyTarget) return;
    denyShiftAdjustment(denyTarget.id, myPerson?.name ?? "Manager", denyComment);
    setDenyTarget(null);
    setDenyComment("");
    pushToast({ tone: "success", message: "Adjustment denied" });
  };

  const handleUndo = (id: string) => {
    revertShiftAdjustmentApproval(id, myPerson?.name ?? "Manager");
    pushToast({ tone: "success", message: "Approval reverted" });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-ink-muted">
          {pendingCount > 0
            ? `${pendingCount} pending request${pendingCount === 1 ? "" : "s"} for ${team.name}`
            : "No pending requests"}
        </p>
      </div>

      {teamRequests.length === 0 ? (
        <div className="mt-6 rounded-xl border border-hairline bg-surface-2 p-10 text-center">
          <p className="text-sm font-medium text-ink">No adjustment requests yet</p>
          <p className="mt-1 text-xs text-ink-muted">
            When team members ask for early out or late in, it will show up here.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-hairline bg-surface-2">
          <ul className="divide-y divide-hairline md:hidden">
            {teamRequests.map((r) => {
              const person = personById.get(r.personId);
              return (
                <li key={r.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </p>
                    <AdjustmentStatusBadge status={r.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-ink-subtle">Type</dt>
                    <dd className="text-ink-muted">{typeLabel(r.adjustmentType)}</dd>
                    <dt className="text-ink-subtle">Date</dt>
                    <dd className="text-ink-muted">
                      {formatShortDate(r.date)} at {r.requestedTime}
                    </dd>
                    {r.reviewedBy && (
                      <>
                        <dt className="text-ink-subtle">Reviewed by</dt>
                        <dd className="text-ink-muted">{r.reviewedBy}</dd>
                      </>
                    )}
                  </dl>
                  {r.reason && (
                    <p className="text-xs text-ink-muted">
                      <span className="text-ink-subtle">Reason: </span>
                      {r.reason}
                    </p>
                  )}
                  {r.status === "denied" && r.reviewerComment && (
                    <p className="text-[11px] text-danger">
                      Comment: {r.reviewerComment}
                    </p>
                  )}
                  {r.status === "pending" ? (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleApprove(r)}
                        className="flex-1 rounded-md border border-success/25 bg-success-weak px-2.5 py-2 text-[12px] font-medium text-success transition-colors hover:bg-success/15"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDenyTarget(r);
                          setDenyComment("");
                        }}
                        className="flex-1 rounded-md border border-danger/25 bg-danger-weak px-2.5 py-2 text-[12px] font-medium text-danger transition-colors hover:bg-danger/15"
                      >
                        Deny
                      </button>
                    </div>
                  ) : (
                    r.status === "approved" && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => handleUndo(r.id)}
                          className="rounded-md border border-hairline bg-surface-3 px-2.5 py-1.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                        >
                          Undo
                        </button>
                      </div>
                    )
                  )}
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-hairline text-[11px] uppercase tracking-wide text-ink-subtle">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Requested time</th>
                <th className="px-4 py-2.5 font-medium">Reason</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teamRequests.map((r) => {
                const person = personById.get(r.personId);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-hairline last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-ink">
                      {person?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {typeLabel(r.adjustmentType)}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {formatShortDate(r.date)}
                    </td>
                    <td className="px-4 py-3 text-ink-subtle">
                      {r.requestedTime}
                    </td>
                    <td className="max-w-48 px-4 py-3">
                      <p className="truncate text-ink-muted">{r.reason ?? "—"}</p>
                      {r.status === "denied" && r.reviewerComment && (
                        <p className="mt-0.5 text-[11px] text-danger">
                          Comment: {r.reviewerComment}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AdjustmentStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleApprove(r)}
                            className="rounded-md border border-success/25 bg-success-weak px-2.5 py-1 text-[11px] font-medium text-success transition-colors hover:bg-success/15"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDenyTarget(r);
                              setDenyComment("");
                            }}
                            className="rounded-md border border-danger/25 bg-danger-weak px-2.5 py-1 text-[11px] font-medium text-danger transition-colors hover:bg-danger/15"
                          >
                            Deny
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <p className="text-[11px] text-ink-faint">
                            {r.reviewedBy ? `by ${r.reviewedBy}` : ""}
                          </p>
                          {r.status === "approved" && (
                            <button
                              type="button"
                              onClick={() => handleUndo(r.id)}
                              className="rounded-md border border-hairline bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition-colors hover:text-ink"
                            >
                              Undo
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal
        open={!!denyTarget}
        title="Deny adjustment request"
        description={
          denyTarget
            ? `${personById.get(denyTarget.personId)?.name ?? "This person"} — ${typeLabel(denyTarget.adjustmentType)}, ${formatShortDate(denyTarget.date)} at ${denyTarget.requestedTime}`
            : undefined
        }
        tone="danger"
        confirmLabel="Deny request"
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
            placeholder="e.g. Insufficient coverage that day"
            className="w-full resize-none rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
      </Modal>
    </div>
  );
}