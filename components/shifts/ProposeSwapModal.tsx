"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useCompany, hasApprovedLeaveOn } from "@/lib/company-data";
import type { Shift, SwapType } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import { localDateStr } from "@/lib/format";
import { AlertTriangleIcon } from "@/components/ui/icons";

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const total = h * 60 + m + durationMinutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

interface ProposeSwapModalProps {
  open: boolean;
  shift: Shift;
  personId: string;
  onClose: () => void;
}

export default function ProposeSwapModal({
  open,
  shift,
  personId,
  onClose,
}: ProposeSwapModalProps) {
  const { proposeSwap, getSwapableCoworkers, shiftAssignments, shifts, leaveRequests } =
    useCompany();
  const { pushToast } = useToast();
  const [swapType, setSwapType] = useState<SwapType>("giveaway");
  const [targetPersonId, setTargetPersonId] = useState("");
  const [requestedShiftId, setRequestedShiftId] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const coworkers = useMemo(
    () => getSwapableCoworkers(personId, shift.id),
    [getSwapableCoworkers, personId, shift.id],
  );

  const today = localDateStr(new Date());

  const targetLeaveConflict = useMemo(
    () => (targetPersonId ? hasApprovedLeaveOn(targetPersonId, shift.date, leaveRequests) : undefined),
    [targetPersonId, shift.date, leaveRequests],
  );

  const targetShiftOptions = useMemo(() => {
    if (!targetPersonId) return [];
    const shiftIds = new Set(
      shiftAssignments
        .filter((a) => a.personId === targetPersonId && a.status === "approved")
        .map((a) => a.shiftId),
    );
    return shifts
      .filter((s) => shiftIds.has(s.id) && s.status === "published" && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [shiftAssignments, shifts, targetPersonId, today]);

  const reset = () => {
    setSwapType("giveaway");
    setTargetPersonId("");
    setRequestedShiftId("");
    setComment("");
    setError(null);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!targetPersonId) {
      setError("Choose a coworker.");
      return;
    }
    if (swapType === "trade" && !requestedShiftId) {
      setError("Choose one of their shifts to trade for.");
      return;
    }
    if (targetLeaveConflict) {
      setError("This coworker has approved leave that day — pick someone else.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await proposeSwap({
        swapType,
        offeredShiftId: shift.id,
        requestedShiftId: swapType === "trade" ? requestedShiftId : undefined,
        initiatorPersonId: personId,
        targetPersonId,
        initiatorComment: comment,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't submit the swap request.");
        return;
      }
      reset();
      pushToast({ tone: "success", message: "Swap request sent" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Propose shift swap"
      description={`${shift.title} · ${shift.date} · ${shift.startTime} – ${getEndTime(shift.startTime, shift.durationMinutes)}`}
      confirmLabel="Send request"
      confirmLoading={submitting}
      onConfirm={handleSubmit}
      onClose={() => {
        reset();
        onClose();
      }}
    >
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">Type</label>
          <div className="flex items-center rounded-lg border border-hairline bg-surface-3 p-0.5">
            <button
              type="button"
              onClick={() => {
                setSwapType("giveaway");
                setRequestedShiftId("");
              }}
              className={`h-7 flex-1 rounded-md px-3 text-[12px] font-medium transition-colors ${
                swapType === "giveaway" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              Give away
            </button>
            <button
              type="button"
              onClick={() => setSwapType("trade")}
              className={`h-7 flex-1 rounded-md px-3 text-[12px] font-medium transition-colors ${
                swapType === "trade" ? "bg-primary text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              Trade
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">Coworker</label>
          <select
            value={targetPersonId}
            onChange={(e) => {
              setTargetPersonId(e.target.value);
              setRequestedShiftId("");
            }}
            className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
          >
            <option value="">Select a coworker</option>
            {coworkers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {coworkers.length === 0 && (
            <p className="mt-1 text-[11px] text-ink-faint">No eligible coworkers on this team.</p>
          )}
          {targetLeaveConflict && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-danger">
              <AlertTriangleIcon className="size-3" />
              Approved {targetLeaveConflict.type} leave {targetLeaveConflict.startDate} –{" "}
              {targetLeaveConflict.endDate}
            </p>
          )}
        </div>
        {swapType === "trade" && targetPersonId && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
              In exchange for
            </label>
            <select
              value={requestedShiftId}
              onChange={(e) => setRequestedShiftId(e.target.value)}
              className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            >
              <option value="">Select their shift</option>
              {targetShiftOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {s.date} · {s.startTime}
                </option>
              ))}
            </select>
            {targetShiftOptions.length === 0 && (
              <p className="mt-1 text-[11px] text-ink-faint">
                This coworker has no upcoming shifts to trade.
              </p>
            )}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
            Note <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add context for your coworker"
            className="w-full resize-none rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-danger/25 bg-danger-weak px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
