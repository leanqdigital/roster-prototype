"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useCompany } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import { daysInclusive } from "@/lib/company-data/business";

interface RequestLeaveModalProps {
  open: boolean;
  personId: string;
  onClose: () => void;
}

export default function RequestLeaveModal({
  open,
  personId,
  onClose,
}: RequestLeaveModalProps) {
  const { requestLeave, leaveTypes, getPersonLeaveBalance } = useCompany();
  const { pushToast } = useToast();

  const activeLeaveTypes = useMemo(
    () => leaveTypes.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [leaveTypes],
  );

  const [type, setType] = useState<string>(() => activeLeaveTypes[0]?.key ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedLeaveType = activeLeaveTypes.find((t) => t.key === type);
  const balanceDays = selectedLeaveType
    ? getPersonLeaveBalance(personId, selectedLeaveType.id)
    : 0;

  const requestedDays = useMemo(
    () => (startDate && endDate && endDate >= startDate ? daysInclusive(startDate, endDate) : null),
    [startDate, endDate],
  );
  const exceedsBalance =
    !!selectedLeaveType?.tracksBalance && requestedDays !== null && requestedDays > balanceDays;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await requestLeave(personId, { type, startDate, endDate, reason });
      if (!result.ok) {
        setError(result.error ?? "Couldn't submit the request.");
        return;
      }
      setType(activeLeaveTypes[0]?.key ?? "");
      setStartDate("");
      setEndDate("");
      setReason("");
      setError(null);
      pushToast({ tone: "success", message: "Leave request submitted" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request leave"
      description="Submit a leave request for review."
      confirmLabel="Submit request"
      confirmLoading={submitting}
      onConfirm={handleSubmit}
      onClose={onClose}
    >
      <div className="mt-4 space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
          >
            {activeLeaveTypes.map((t) => (
              <option key={t.key} value={t.key}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
              Start date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
              End date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
            Reason <span className="text-ink-faint">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Tell your manager why you need this time off"
            className="w-full resize-none rounded-lg border border-hairline bg-surface-3 px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary"
          />
        </div>
        {selectedLeaveType?.tracksBalance && requestedDays !== null && (
          <p
            className={`text-[11px] font-medium ${exceedsBalance ? "text-danger" : "text-ink-subtle"}`}
          >
            {requestedDays} day{requestedDays === 1 ? "" : "s"} requested — {balanceDays}{" "}
            day{balanceDays === 1 ? "" : "s"} available
            {exceedsBalance ? " (exceeds balance)" : ""}
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-danger/25 bg-danger-weak px-3 py-2 text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
