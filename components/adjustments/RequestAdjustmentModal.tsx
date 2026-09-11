"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useCompany } from "@/lib/company-data";
import { useToast } from "@/lib/toast";
import type { ShiftAdjustmentType } from "@/lib/company-data";
import { localDateStr } from "@/lib/format";

export const ADJUSTMENT_TYPES: { value: ShiftAdjustmentType; label: string; hint: string }[] = [
  { value: "late_in", label: "Late in", hint: "Start your shift later than scheduled" },
  { value: "early_out", label: "Early out", hint: "Leave your shift earlier than scheduled" },
];

interface RequestAdjustmentModalProps {
  open: boolean;
  personId: string;
  initialDate?: string;
  onClose: () => void;
}

export default function RequestAdjustmentModal({
  open,
  personId,
  initialDate,
  onClose,
}: RequestAdjustmentModalProps) {
  const { requestShiftAdjustment } = useCompany();
  const { pushToast } = useToast();
  const [adjustmentType, setAdjustmentType] = useState<ShiftAdjustmentType>("late_in");
  const [date, setDate] = useState(initialDate ?? localDateStr(new Date()));
  const [requestedTime, setRequestedTime] = useState("09:00");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await requestShiftAdjustment(personId, {
        adjustmentType,
        date,
        requestedTime,
        reason,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't submit the request.");
        return;
      }
      setAdjustmentType("late_in");
      setDate(initialDate ?? localDateStr(new Date()));
      setRequestedTime("09:00");
      setReason("");
      setError(null);
      pushToast({ tone: "success", message: "Adjustment request submitted" });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request a time adjustment"
      description="Ask your manager for permission to come in late or leave early."
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
          <div className="grid grid-cols-2 gap-2">
            {ADJUSTMENT_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAdjustmentType(t.value)}
                className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                  adjustmentType === t.value
                    ? "border-primary/50 bg-primary-weak"
                    : "border-hairline bg-surface-3 hover:bg-surface-4"
                }`}
              >
                <span className="block text-[13px] font-medium text-ink">
                  {t.label}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">
                  {t.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-8 w-full rounded-lg border border-hairline bg-surface-3 px-2.5 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-subtle">
              Requested time
            </label>
            <input
              type="time"
              value={requestedTime}
              onChange={(e) => setRequestedTime(e.target.value)}
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
            placeholder="Tell your manager why you need this adjustment"
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